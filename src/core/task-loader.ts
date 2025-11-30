/**
 * Optimized task loading with index-first, hydrate-later pattern
 * Dramatically reduces git operations for multi-branch task loading
 */

import type { GitOperations } from "../git/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { Task } from "../types/index.ts";

export interface RemoteIndexEntry {
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
				// Get all task files in this branch
				const files = await git.listFilesInTree(ref, `${backlogDir}/tasks`);
				if (files.length === 0) continue;

				// Get last modified times for all files in one pass
				const lm = await git.getBranchLastModifiedMap(ref, `${backlogDir}/tasks`, sinceDays);

				for (const f of files) {
					// Extract task ID from filename
					// Extract task ID from filename (support subtasks like task-123.01)
					const m = f.match(/task-(\d+(?:\.\d+)?)/);
					if (!m) continue;

					const id = `task-${m[1]}`;
					const lastModified = lm.get(f) ?? new Date(0);
					const entry: RemoteIndexEntry = { id, branch: br, path: f, lastModified };

					const arr = out.get(id);
					if (arr) {
						arr.push(entry);
					} else {
						out.set(id, [entry]);
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
export async function hydrateTasks(
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
				// Get all task files in this branch (use branch name directly, not origin/)
				const files = await git.listFilesInTree(br, `${backlogDir}/tasks`);
				if (files.length === 0) continue;

				// Get last modified times for all files in one pass
				const lm = await git.getBranchLastModifiedMap(br, `${backlogDir}/tasks`, sinceDays);

				for (const f of files) {
					// Extract task ID from filename (support subtasks like task-123.01)
					const m = f.match(/task-(\d+(?:\.\d+)?)/);
					if (!m) continue;

					const id = `task-${m[1]}`;
					const lastModified = lm.get(f) ?? new Date(0);
					const entry: RemoteIndexEntry = { id, branch: br, path: f, lastModified };

					const arr = out.get(id);
					if (arr) {
						arr.push(entry);
					} else {
						out.set(id, [entry]);
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
export function chooseWinners(
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
