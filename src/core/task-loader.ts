/**
 * Task loading with optimized index-first, hydrate-later pattern
 * Dramatically reduces git operations for multi-branch task loading
 *
 * This is the single module for all cross-branch task loading:
 * - Local filesystem tasks
 * - Other local branch tasks
 * - Remote branch tasks
 */

import { DEFAULT_DIRECTORIES } from "../constants/index.ts";
import type { GitOperations } from "../git/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import type { TaskDirectoryType } from "./cross-branch-tasks.ts";

export interface BranchTaskStateEntry {
	id: string;
	type: TaskDirectoryType;
	lastModified: Date;
	branch: string;
	path: string;
}

const STATE_DIRECTORIES: Array<{ path: string; type: TaskDirectoryType }> = [
	{ path: "tasks", type: "task" },
	{ path: "drafts", type: "draft" },
	{ path: "archive/tasks", type: "archived" },
	{ path: "completed", type: "completed" },
];

function getTaskTypeFromPath(path: string, backlogDir: string): TaskDirectoryType | null {
	const normalized = path.startsWith(`${backlogDir}/`) ? path.slice(backlogDir.length + 1) : path;

	for (const { path: dir, type } of STATE_DIRECTORIES) {
		if (normalized.startsWith(`${dir}/`)) {
			return type;
		}
	}

	return null;
}

/**
 * Get the appropriate loading message based on remote operations configuration
 */
export function getTaskLoadingMessage(config: BacklogConfig | null): string {
	return config?.remoteOperations === false
		? "Loading tasks from local branches..."
		: "Loading tasks from local and remote branches...";
}

interface RemoteIndexEntry {
	id: string;
	branch: string;
	path: string; // "backlog/tasks/task-123 - title.md"
	lastModified: Date;
}

function normalizeRemoteBranch(branch: string): string | null {
	let br = branch.trim();
	if (!br) return null;
	br = br.replace(/^refs\/remotes\//, "");
	if (br === "origin" || br === "HEAD" || br === "origin/HEAD") return null;
	if (br.startsWith("origin/")) br = br.slice("origin/".length);
	// Filter weird cases like "origin" again after stripping prefix
	if (!br || br === "HEAD" || br === "origin") return null;
	return br;
}

/**
 * Normalize a local branch name, filtering out invalid entries
 */
function normalizeLocalBranch(branch: string, currentBranch: string): string | null {
	const br = branch.trim();
	if (!br) return null;
	// Skip HEAD, origin refs, and current branch
	if (br === "HEAD" || br.includes("HEAD")) return null;
	if (br.startsWith("origin/") || br.startsWith("refs/remotes/")) return null;
	if (br === "origin") return null;
	// Skip current branch - we already have its tasks from filesystem
	if (br === currentBranch) return null;
	return br;
}

/**
 * Build a cheap index of remote tasks without fetching content
 * This is VERY fast as it only lists files and gets modification times in batch
 */
export async function buildRemoteTaskIndex(
	git: GitOperations,
	branches: string[],
	backlogDir = "backlog",
	sinceDays?: number,
	stateCollector?: BranchTaskStateEntry[],
): Promise<Map<string, RemoteIndexEntry[]>> {
	const out = new Map<string, RemoteIndexEntry[]>();

	const normalized = branches.map(normalizeRemoteBranch).filter((b): b is string => Boolean(b));

	// Do branches in parallel but not unbounded
	const CONCURRENCY = 4;
	const queue = [...normalized];

	const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
		while (queue.length) {
			const br = queue.pop();
			if (!br) break;

			const ref = `origin/${br}`;

			try {
				const listPath = stateCollector ? backlogDir : `${backlogDir}/tasks`;

				// Get backlog files for this branch
				const files = await git.listFilesInTree(ref, listPath);
				if (files.length === 0) continue;

				// Get last modified times for all files in one pass
				const lm = await git.getBranchLastModifiedMap(ref, listPath, sinceDays);

				for (const f of files) {
					// Extract task ID from filename
					// Extract task ID from filename (support subtasks like task-123.01)
					const m = f.match(/task-(\d+(?:\.\d+)?)/);
					if (!m) continue;

					const id = `task-${m[1]}`;
					const lastModified = lm.get(f) ?? new Date(0);
					const entry: RemoteIndexEntry = { id, branch: br, path: f, lastModified };

					// Collect full state info when requested
					const type = getTaskTypeFromPath(f, backlogDir);
					if (!stateCollector && type !== "task") {
						continue;
					}
					if (type && stateCollector) {
						stateCollector.push({
							id,
							type,
							branch: br,
							path: f,
							lastModified,
						});
					}

					// Only index active tasks for hydration selection
					if (type === "task") {
						const arr = out.get(id);
						if (arr) {
							arr.push(entry);
						} else {
							out.set(id, [entry]);
						}
					}
				}
			} catch (error) {
				// Branch might not have backlog directory, skip it
				console.debug(`Skipping branch ${br}: ${error}`);
			}
		}
	});

	await Promise.all(workers);
	return out;
}

/**
 * Hydrate tasks by fetching their content
 * Only call this for the "winner" tasks that we actually need
 */
async function hydrateTasks(
	git: GitOperations,
	winners: Array<{ id: string; ref: string; path: string }>,
): Promise<Task[]> {
	const CONCURRENCY = 8;
	const result: Task[] = [];
	let i = 0;

	async function worker() {
		while (i < winners.length) {
			const idx = i++;
			if (idx >= winners.length) break;

			const w = winners[idx];
			if (!w) break;

			try {
				const content = await git.showFile(w.ref, w.path);
				const task = parseTask(content);
				if (task) {
					// Mark as remote source and branch
					task.source = "remote";
					// Extract branch name from ref (e.g., "origin/main" -> "main")
					task.branch = w.ref.replace("origin/", "");
					result.push(task);
				}
			} catch (error) {
				console.error(`Failed to hydrate task ${w.id} from ${w.ref}:${w.path}`, error);
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, winners.length) }, worker));
	return result;
}

/**
 * Build a cheap index of tasks from local branches (excluding current branch)
 * Similar to buildRemoteTaskIndex but for local refs
 */
export async function buildLocalBranchTaskIndex(
	git: GitOperations,
	branches: string[],
	currentBranch: string,
	backlogDir = "backlog",
	sinceDays?: number,
	stateCollector?: BranchTaskStateEntry[],
): Promise<Map<string, RemoteIndexEntry[]>> {
	const out = new Map<string, RemoteIndexEntry[]>();

	const normalized = branches.map((b) => normalizeLocalBranch(b, currentBranch)).filter((b): b is string => Boolean(b));

	if (normalized.length === 0) {
		return out;
	}

	// Do branches in parallel but not unbounded
	const CONCURRENCY = 4;
	const queue = [...normalized];

	const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
		while (queue.length) {
			const br = queue.pop();
			if (!br) break;

			try {
				const listPath = stateCollector ? backlogDir : `${backlogDir}/tasks`;

				// Get backlog files in this branch
				const files = await git.listFilesInTree(br, listPath);
				if (files.length === 0) continue;

				// Get last modified times for all files in one pass
				const lm = await git.getBranchLastModifiedMap(br, listPath, sinceDays);

				for (const f of files) {
					// Extract task ID from filename (support subtasks like task-123.01)
					const m = f.match(/task-(\d+(?:\.\d+)?)/);
					if (!m) continue;

					const id = `task-${m[1]}`;
					const lastModified = lm.get(f) ?? new Date(0);
					const entry: RemoteIndexEntry = { id, branch: br, path: f, lastModified };

					// Collect full state info when requested
					const type = getTaskTypeFromPath(f, backlogDir);
					if (!stateCollector && type !== "task") {
						continue;
					}
					if (type && stateCollector) {
						stateCollector.push({
							id,
							type,
							branch: br,
							path: f,
							lastModified,
						});
					}

					// Only index active tasks for hydration selection
					if (type === "task") {
						const arr = out.get(id);
						if (arr) {
							arr.push(entry);
						} else {
							out.set(id, [entry]);
						}
					}
				}
			} catch (error) {
				// Branch might not have backlog directory, skip it
				if (process.env.DEBUG) {
					console.debug(`Skipping local branch ${br}: ${error}`);
				}
			}
		}
	});

	await Promise.all(workers);
	return out;
}

/**
 * Choose which remote tasks need to be hydrated based on strategy
 * Returns only the tasks that are newer or more progressed than local versions
 */
function chooseWinners(
	localById: Map<string, Task>,
	remoteIndex: Map<string, RemoteIndexEntry[]>,
	strategy: "most_recent" | "most_progressed" = "most_progressed",
): Array<{ id: string; ref: string; path: string }> {
	const winners: Array<{ id: string; ref: string; path: string }> = [];

	for (const [id, entries] of remoteIndex) {
		const local = localById.get(id);

		if (!local) {
			// No local version - take the newest remote
			const best = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));
			winners.push({ id, ref: `origin/${best.branch}`, path: best.path });
			continue;
		}

		// If strategy is "most_recent", only hydrate if any remote is newer
		if (strategy === "most_recent") {
			const localTs = local.updatedDate ? new Date(local.updatedDate).getTime() : 0;
			const newestRemote = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));

			if (newestRemote.lastModified.getTime() > localTs) {
				winners.push({
					id,
					ref: `origin/${newestRemote.branch}`,
					path: newestRemote.path,
				});
			}
			continue;
		}

		// For "most_progressed", we might need to check if remote is newer
		// to potentially have a more progressed status
		const localTs = local.updatedDate ? new Date(local.updatedDate).getTime() : 0;
		const maybeNewer = entries.some((e) => e.lastModified.getTime() > localTs);

		if (maybeNewer) {
			// Only hydrate the newest remote to check if it's more progressed
			const newestRemote = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));
			winners.push({
				id,
				ref: `origin/${newestRemote.branch}`,
				path: newestRemote.path,
			});
		}
	}

	return winners;
}

/**
 * Find and load a specific task from remote branches
 * Searches through recent remote branches for the task and returns the newest version
 */
export async function findTaskInRemoteBranches(
	git: GitOperations,
	taskId: string,
	backlogDir = "backlog",
	sinceDays = 30,
): Promise<Task | null> {
	try {
		// Check if we have any remote
		if (!(await git.hasAnyRemote())) return null;

		// Get recent remote branches
		const branches = await git.listRecentRemoteBranches(sinceDays);
		if (branches.length === 0) return null;

		// Build task index for remote branches
		const remoteIndex = await buildRemoteTaskIndex(git, branches, backlogDir, sinceDays);

		// Check if the task exists in the index
		const entries = remoteIndex.get(taskId);
		if (!entries || entries.length === 0) return null;

		// Get the newest version
		const best = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));

		// Hydrate the task
		const ref = `origin/${best.branch}`;
		const content = await git.showFile(ref, best.path);
		const task = parseTask(content);
		if (task) {
			task.source = "remote";
			task.branch = best.branch;
		}
		return task;
	} catch (error) {
		if (process.env.DEBUG) {
			console.error(`Failed to find task ${taskId} in remote branches:`, error);
		}
		return null;
	}
}

/**
 * Find and load a specific task from local branches (excluding current branch)
 * Searches through recent local branches for the task and returns the newest version
 */
export async function findTaskInLocalBranches(
	git: GitOperations,
	taskId: string,
	backlogDir = "backlog",
	sinceDays = 30,
): Promise<Task | null> {
	try {
		const currentBranch = await git.getCurrentBranch();
		if (!currentBranch) return null;

		// Get recent local branches
		const allBranches = await git.listRecentBranches(sinceDays);
		const localBranches = allBranches.filter(
			(b) => !b.startsWith("origin/") && !b.startsWith("refs/remotes/") && b !== "origin",
		);

		if (localBranches.length <= 1) return null; // Only current branch

		// Build task index for local branches
		const localIndex = await buildLocalBranchTaskIndex(git, localBranches, currentBranch, backlogDir, sinceDays);

		// Check if the task exists in the index
		const entries = localIndex.get(taskId);
		if (!entries || entries.length === 0) return null;

		// Get the newest version
		const best = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));

		// Hydrate the task
		const content = await git.showFile(best.branch, best.path);
		const task = parseTask(content);
		if (task) {
			task.source = "local-branch";
			task.branch = best.branch;
		}
		return task;
	} catch (error) {
		if (process.env.DEBUG) {
			console.error(`Failed to find task ${taskId} in local branches:`, error);
		}
		return null;
	}
}

/**
 * Load all remote tasks using optimized index-first, hydrate-later pattern
 * Dramatically reduces git operations by only fetching content for tasks that need it
 */
export async function loadRemoteTasks(
	gitOps: GitOperations,
	userConfig: BacklogConfig | null = null,
	onProgress?: (message: string) => void,
	localTasks?: Task[],
	stateCollector?: BranchTaskStateEntry[],
): Promise<Task[]> {
	try {
		// Skip remote operations if disabled
		if (userConfig?.remoteOperations === false) {
			onProgress?.("Remote operations disabled - skipping remote tasks");
			return [];
		}

		// Fetch remote branches
		onProgress?.("Fetching remote branches...");
		await gitOps.fetch();

		// Use recent branches only for better performance
		const days = userConfig?.activeBranchDays ?? 30;
		const branches = await gitOps.listRecentRemoteBranches(days);

		if (branches.length === 0) {
			onProgress?.("No recent remote branches found");
			return [];
		}

		onProgress?.(`Indexing ${branches.length} recent remote branches (last ${days} days)...`);

		// Build a cheap index without fetching content
		const backlogDir = DEFAULT_DIRECTORIES.BACKLOG;
		const remoteIndex = await buildRemoteTaskIndex(gitOps, branches, backlogDir, days, stateCollector);

		if (remoteIndex.size === 0) {
			onProgress?.("No remote tasks found");
			return [];
		}

		onProgress?.(`Found ${remoteIndex.size} unique tasks across remote branches`);

		// If we have local tasks, use them to determine which remote tasks to hydrate
		let winners: Array<{ id: string; ref: string; path: string }>;

		if (localTasks && localTasks.length > 0) {
			// Build local task map for comparison
			const localById = new Map(localTasks.map((t) => [t.id, t]));
			const strategy = userConfig?.taskResolutionStrategy || "most_progressed";

			// Only hydrate remote tasks that are newer or missing locally
			winners = chooseWinners(localById, remoteIndex, strategy);
			onProgress?.(`Hydrating ${winners.length} remote candidates...`);
		} else {
			// No local tasks, need to hydrate all remote tasks (take newest of each)
			winners = [];
			for (const [id, entries] of remoteIndex) {
				const best = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));
				winners.push({ id, ref: `origin/${best.branch}`, path: best.path });
			}
			onProgress?.(`Hydrating ${winners.length} remote tasks...`);
		}

		// Only fetch content for the tasks we actually need
		const hydratedTasks = await hydrateTasks(gitOps, winners);

		onProgress?.(`Loaded ${hydratedTasks.length} remote tasks`);
		return hydratedTasks;
	} catch (error) {
		// If fetch fails, we can still work with local tasks
		console.error("Failed to fetch remote tasks:", error);
		return [];
	}
}

/**
 * Resolve conflicts between local and remote tasks based on strategy
 */
function getTaskDate(task: Task): Date {
	if (task.updatedDate) {
		return new Date(task.updatedDate);
	}
	return task.lastModified ?? new Date(0);
}

export function resolveTaskConflict(
	existing: Task,
	incoming: Task,
	statuses: string[],
	strategy: "most_recent" | "most_progressed" = "most_progressed",
): Task {
	if (strategy === "most_recent") {
		const existingDate = getTaskDate(existing);
		const incomingDate = getTaskDate(incoming);
		return existingDate >= incomingDate ? existing : incoming;
	}

	// Default to most_progressed strategy
	// Map status to rank (default to 0 for unknown statuses)
	const currentIdx = statuses.indexOf(existing.status);
	const newIdx = statuses.indexOf(incoming.status);
	const currentRank = currentIdx >= 0 ? currentIdx : 0;
	const newRank = newIdx >= 0 ? newIdx : 0;

	// If incoming task has a more progressed status, use it
	if (newRank > currentRank) {
		return incoming;
	}

	// If statuses are equal, use the most recent
	if (newRank === currentRank) {
		const existingDate = getTaskDate(existing);
		const incomingDate = getTaskDate(incoming);
		return existingDate >= incomingDate ? existing : incoming;
	}

	return existing;
}

/**
 * Load tasks from other local branches (not current branch, not remote)
 * Uses the same optimized index-first, hydrate-later pattern as remote loading
 */
export async function loadLocalBranchTasks(
	gitOps: GitOperations,
	userConfig: BacklogConfig | null = null,
	onProgress?: (message: string) => void,
	localTasks?: Task[],
	stateCollector?: BranchTaskStateEntry[],
): Promise<Task[]> {
	try {
		const currentBranch = await gitOps.getCurrentBranch();
		if (!currentBranch) {
			// Not on a branch (detached HEAD), skip local branch loading
			return [];
		}

		// Get recent local branches (excludes remote refs)
		const days = userConfig?.activeBranchDays ?? 30;
		const allBranches = await gitOps.listRecentBranches(days);

		// Filter to only local branches (not origin/*)
		const localBranches = allBranches.filter(
			(b) => !b.startsWith("origin/") && !b.startsWith("refs/remotes/") && b !== "origin",
		);

		if (localBranches.length <= 1) {
			// Only current branch or no branches
			return [];
		}

		onProgress?.(`Indexing ${localBranches.length - 1} other local branches...`);

		// Build index of tasks from other local branches
		const backlogDir = DEFAULT_DIRECTORIES.BACKLOG;
		const localBranchIndex = await buildLocalBranchTaskIndex(
			gitOps,
			localBranches,
			currentBranch,
			backlogDir,
			days,
			stateCollector,
		);

		if (localBranchIndex.size === 0) {
			return [];
		}

		onProgress?.(`Found ${localBranchIndex.size} unique tasks in other local branches`);

		// Determine which tasks to hydrate
		let winners: Array<{ id: string; ref: string; path: string }>;

		if (localTasks && localTasks.length > 0) {
			// Build local task map for comparison
			const localById = new Map(localTasks.map((t) => [t.id, t]));
			const strategy = userConfig?.taskResolutionStrategy || "most_progressed";

			// Only hydrate tasks that are missing locally or potentially newer
			winners = [];
			for (const [id, entries] of localBranchIndex) {
				const local = localById.get(id);

				if (!local) {
					// Task doesn't exist locally - take the newest from other branches
					const best = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));
					winners.push({ id, ref: best.branch, path: best.path });
					continue;
				}

				// For existing tasks, check if any other branch version is newer
				if (strategy === "most_recent") {
					const localTs = local.updatedDate ? new Date(local.updatedDate).getTime() : 0;
					const newestOther = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));

					if (newestOther.lastModified.getTime() > localTs) {
						winners.push({ id, ref: newestOther.branch, path: newestOther.path });
					}
				} else {
					// For most_progressed, we need to hydrate to check status
					const localTs = local.updatedDate ? new Date(local.updatedDate).getTime() : 0;
					const maybeNewer = entries.some((e) => e.lastModified.getTime() > localTs);

					if (maybeNewer) {
						const newestOther = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));
						winners.push({ id, ref: newestOther.branch, path: newestOther.path });
					}
				}
			}
		} else {
			// No local tasks, hydrate all from other branches (take newest of each)
			winners = [];
			for (const [id, entries] of localBranchIndex) {
				const best = entries.reduce((a, b) => (a.lastModified >= b.lastModified ? a : b));
				winners.push({ id, ref: best.branch, path: best.path });
			}
		}

		if (winners.length === 0) {
			return [];
		}

		onProgress?.(`Hydrating ${winners.length} tasks from other local branches...`);

		// Hydrate the tasks - note: ref is the branch name directly (not origin/)
		const hydratedTasks = await hydrateTasks(gitOps, winners);

		// Mark these as coming from local branches
		for (const task of hydratedTasks) {
			task.source = "local-branch";
		}

		onProgress?.(`Loaded ${hydratedTasks.length} tasks from other local branches`);
		return hydratedTasks;
	} catch (error) {
		if (process.env.DEBUG) {
			console.error("Failed to load local branch tasks:", error);
		}
		return [];
	}
}
