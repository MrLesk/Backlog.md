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
import type { GitBranchTip, GitOperations } from "../git/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { extractAnyPrefix } from "../utils/prefix-config.ts";
import {
	canonicalTaskId,
	extractTaskIdFromFilename,
	normalizeTaskId,
	normalizeTaskIdentity,
} from "../utils/task-path.ts";
import type { TaskDirectoryType } from "./cross-branch-tasks.ts";
import { normalizeTaskLifecyclePath } from "./task-identity-index.ts";

/** Default prefix for tasks */
const DEFAULT_TASK_PREFIX = "task";

export function getBranchHistoryCutoff(activeBranchDays: number, now = Date.now()): Date | undefined {
	if (!activeBranchDays) return undefined;
	const cutoff = new Date(now);
	cutoff.setUTCHours(0, 0, 0, 0);
	cutoff.setUTCDate(cutoff.getUTCDate() - activeBranchDays);
	return cutoff;
}

export interface BranchTaskStateEntry {
	id: string;
	type: TaskDirectoryType;
	lastModified: Date;
	branch: string;
	path: string;
	task?: Task;
}

export interface BranchTaskLoadResult {
	entries: BranchTaskStateEntry[];
	/** False when at least one branch index or selected task payload could not be read. */
	complete: boolean;
}

function extractConfiguredTaskId(filePath: string, prefix: string): string | null {
	const filename = filePath.slice(filePath.lastIndexOf("/") + 1);
	const taskId = extractTaskIdFromFilename(filename);
	const taskPrefix = taskId ? extractAnyPrefix(taskId) : null;
	return taskPrefix?.toLowerCase() === prefix.toLowerCase() ? taskId : null;
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
	commit: string;
	stateEntry?: BranchTaskStateEntry;
}

interface HydrationCandidate {
	id: string;
	ref: string;
	path: string;
	commit: string;
	stateEntry?: BranchTaskStateEntry;
}

interface CachedTaskTreeEntry {
	id: string;
	path: string;
	type: TaskDirectoryType | null;
	lastModified: number;
}

interface PinnedBranchRef {
	branch: string;
	ref: string;
	commit: string;
	source: "local-branch" | "remote";
}

interface HydrationOptions {
	source: "local-branch" | "remote";
	loadTask: (commit: string, path: string) => Promise<Task | null>;
}

function logicalTaskPath(path: string, backlogDir: string): string {
	const normalizedPath = path.replaceAll("\\", "/");
	const normalizedBacklogDir = backlogDir
		.replaceAll("\\", "/")
		.replace(/^\.\//, "")
		.replace(/^\/+|\/+$/g, "");
	const backlogMarker = `/${normalizedBacklogDir}/`;
	const markerIndex = normalizedPath.indexOf(backlogMarker);
	const logicalPath = markerIndex >= 0 ? normalizedPath.slice(markerIndex + 1) : normalizedPath.replace(/^\.\//, "");
	return normalizeTaskLifecyclePath(logicalPath, normalizedBacklogDir);
}

function lifecycleRank(type: TaskDirectoryType | undefined): number {
	if (type === "task") return 2;
	if (type === "completed") return 1;
	return 0;
}

function isPreferredIdentityEntry(candidate: RemoteIndexEntry, current: RemoteIndexEntry): boolean {
	const timeDifference = candidate.lastModified.getTime() - current.lastModified.getTime();
	if (timeDifference !== 0) return timeDifference > 0;
	const rankDifference = lifecycleRank(candidate.stateEntry?.type) - lifecycleRank(current.stateEntry?.type);
	if (rankDifference !== 0) return rankDifference > 0;
	return `${candidate.branch}\0${candidate.path}`.localeCompare(`${current.branch}\0${current.path}`) < 0;
}

function selectPreferredIdentityEntry(entries: RemoteIndexEntry[]): RemoteIndexEntry {
	const first = entries[0];
	if (!first) throw new Error("Cannot select a task from an empty branch index");
	return entries
		.slice(1)
		.reduce((current, candidate) => (isPreferredIdentityEntry(candidate, current) ? candidate : current), first);
}

function chooseIdentityHydrationCandidates(
	index: Map<string, RemoteIndexEntry[]>,
	localTasks: Task[] | undefined,
	backlogDir: string,
	toRef: (entry: RemoteIndexEntry) => string,
): HydrationCandidate[] {
	const localIdentities = new Set(
		(localTasks ?? [])
			.filter((task) => task.filePath)
			.map((task) => `${canonicalTaskId(task.id)}\0${logicalTaskPath(task.filePath ?? "", backlogDir)}`),
	);
	const winners = new Map<string, RemoteIndexEntry>();
	for (const entries of index.values()) {
		for (const entry of entries) {
			const identity = `${canonicalTaskId(entry.id)}\0${logicalTaskPath(entry.path, backlogDir)}`;
			if (localIdentities.has(identity)) continue;
			const current = winners.get(identity);
			if (!current || isPreferredIdentityEntry(entry, current)) winners.set(identity, entry);
		}
	}

	return [...winners.values()].map((entry) => ({
		id: entry.id,
		ref: toRef(entry),
		path: entry.path,
		commit: entry.commit,
		stateEntry: entry.stateEntry,
	}));
}

function mergeHydrationCandidates(
	primary: HydrationCandidate[],
	supplemental: HydrationCandidate[],
): HydrationCandidate[] {
	const candidates = new Map<string, HydrationCandidate>();
	for (const candidate of [...primary, ...supplemental]) {
		candidates.set(`${candidate.ref}\0${candidate.path}\0${candidate.commit}`, candidate);
	}
	return [...candidates.values()];
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
 * Hydrate tasks by fetching their content
 * Only call this for the "winner" tasks that we actually need
 */
async function hydrateTasks(winners: HydrationCandidate[], options: HydrationOptions): Promise<boolean> {
	const CONCURRENCY = 8;
	let i = 0;
	let complete = true;

	async function worker() {
		while (i < winners.length) {
			const idx = i++;
			if (idx >= winners.length) break;

			const w = winners[idx];
			if (!w) break;

			try {
				const task = await options.loadTask(w.commit, w.path);
				if (task) {
					task.source = options.source;
					task.branch = options.source === "remote" ? w.ref.replace(/^origin\//, "") : w.ref;
					if (w.stateEntry) w.stateEntry.task = task;
				}
			} catch (error) {
				complete = false;
				console.error(`Failed to hydrate task ${w.id} from ${w.ref}:${w.path}`, error);
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, winners.length) }, worker));
	return complete;
}

/**
 * Choose which remote tasks need to be hydrated based on strategy
 * Returns only the tasks that are newer or more progressed than local versions
 */
function chooseWinners(
	localById: Map<string, Task>,
	remoteIndex: Map<string, RemoteIndexEntry[]>,
	strategy: "most_recent" | "most_progressed",
	toRef: (entry: RemoteIndexEntry) => string,
): HydrationCandidate[] {
	const winners: HydrationCandidate[] = [];

	for (const [id, entries] of remoteIndex) {
		const local = localById.get(id);

		if (!local) {
			// No local version - take the newest remote
			const best = selectPreferredIdentityEntry(entries);
			winners.push({
				id,
				ref: toRef(best),
				path: best.path,
				commit: best.commit,
				stateEntry: best.stateEntry,
			});
			continue;
		}

		// If strategy is "most_recent", only hydrate if any remote is newer
		if (strategy === "most_recent") {
			const localTs = local.updatedDate ? new Date(local.updatedDate).getTime() : 0;
			const newestRemote = selectPreferredIdentityEntry(entries);

			if (newestRemote.lastModified.getTime() > localTs) {
				winners.push({
					id,
					ref: toRef(newestRemote),
					path: newestRemote.path,
					commit: newestRemote.commit,
					stateEntry: newestRemote.stateEntry,
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
			const newestRemote = selectPreferredIdentityEntry(entries);
			winners.push({
				id,
				ref: toRef(newestRemote),
				path: newestRemote.path,
				commit: newestRemote.commit,
				stateEntry: newestRemote.stateEntry,
			});
		}
	}

	return winners;
}

/**
 * Reuses immutable branch trees and task blobs for the lifetime of one Core.
 * Branch names are deliberately kept out of cache keys: several refs at one
 * commit share the same Git reads, while fresh state entries retain each ref's
 * provenance for identity and ambiguity resolution.
 */
export class BranchTaskLoader {
	private readonly commitIndexCache = new Map<string, Promise<readonly CachedTaskTreeEntry[]>>();
	private readonly taskCache = new Map<string, { commit: string; promise: Promise<Task | null> }>();

	constructor(private readonly git: GitOperations) {}

	clear(): void {
		this.commitIndexCache.clear();
		this.taskCache.clear();
	}

	retainSnapshot(
		tips: readonly GitBranchTip[],
		options: { backlogDir: string; prefix: string; activeBranchDays: number },
	): void {
		const historyCutoff = getBranchHistoryCutoff(options.activeBranchDays);
		const retainedCommits = new Set(tips.map((tip) => tip.commit));
		const retainedIndexKeys = new Set(
			[...retainedCommits].map((commit) =>
				this.commitIndexKey(commit, options.backlogDir, options.prefix, historyCutoff),
			),
		);
		for (const key of this.commitIndexCache.keys()) {
			if (!retainedIndexKeys.has(key)) this.commitIndexCache.delete(key);
		}
		for (const [key, entry] of this.taskCache) {
			if (!retainedCommits.has(entry.commit)) this.taskCache.delete(key);
		}
	}

	async load(
		tips: readonly GitBranchTip[],
		userConfig: BacklogConfig | null,
		localTasks: Task[],
		includeCompleted: boolean,
		backlogDir: string = DEFAULT_DIRECTORIES.BACKLOG,
		onProgress?: (message: string) => void,
		currentBranch?: string,
	): Promise<BranchTaskLoadResult> {
		const branchRefs = await this.getPinnedBranchRefs(tips, userConfig, currentBranch);
		if (branchRefs.length === 0) return { entries: [], complete: true };

		const remoteCount = branchRefs.filter((branch) => branch.source === "remote").length;
		const localCount = branchRefs.length - remoteCount;
		if (remoteCount > 0) onProgress?.(`Indexing ${remoteCount} recent remote branches...`);
		if (localCount > 0) onProgress?.(`Indexing ${localCount} other local branches...`);

		const prefix = userConfig?.prefixes?.task ?? DEFAULT_TASK_PREFIX;
		const historyCutoff = getBranchHistoryCutoff(userConfig?.activeBranchDays ?? 30);
		const stateEntries: BranchTaskStateEntry[] = [];
		const remoteIndex = new Map<string, RemoteIndexEntry[]>();
		const localIndex = new Map<string, RemoteIndexEntry[]>();
		const queue = [...branchRefs];
		const CONCURRENCY = 4;
		let complete = true;

		const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
			while (queue.length > 0) {
				const branchRef = queue.pop();
				if (!branchRef) break;
				try {
					const tree = await this.loadCommitIndex(branchRef.commit, backlogDir, prefix, historyCutoff);
					const index = branchRef.source === "remote" ? remoteIndex : localIndex;
					for (const cached of tree) {
						const lastModified = new Date(cached.lastModified);
						const entry: RemoteIndexEntry = {
							id: cached.id,
							branch: branchRef.branch,
							path: cached.path,
							lastModified,
							commit: branchRef.commit,
						};
						if (cached.type) {
							entry.stateEntry = {
								id: cached.id,
								type: cached.type,
								branch: branchRef.ref,
								path: cached.path,
								lastModified,
							};
							stateEntries.push(entry.stateEntry);
						}
						if (cached.type === "task" || (includeCompleted && cached.type === "completed")) {
							const entries = index.get(cached.id);
							if (entries) entries.push(entry);
							else index.set(cached.id, [entry]);
						}
					}
				} catch (error) {
					complete = false;
					if (process.env.DEBUG) {
						console.debug(`Skipping branch ${branchRef.ref}: ${error}`);
					}
				}
			}
		});
		await Promise.all(workers);

		const localById = new Map(localTasks.map((task) => [normalizeTaskId(task.id), task]));
		const strategy = userConfig?.taskResolutionStrategy ?? "most_progressed";
		const candidatesFor = (
			index: Map<string, RemoteIndexEntry[]>,
			source: "local-branch" | "remote",
		): HydrationCandidate[] => {
			const toRef =
				source === "remote"
					? (entry: RemoteIndexEntry) => `origin/${entry.branch}`
					: (entry: RemoteIndexEntry) => entry.branch;
			let candidates: HydrationCandidate[];
			if (localTasks.length > 0) {
				candidates = chooseWinners(localById, index, strategy, toRef);
			} else {
				candidates = [];
				for (const [id, entries] of index) {
					const best = selectPreferredIdentityEntry(entries);
					candidates.push({
						id,
						ref: toRef(best),
						path: best.path,
						commit: best.commit,
						stateEntry: best.stateEntry,
					});
				}
			}
			return mergeHydrationCandidates(
				candidates,
				chooseIdentityHydrationCandidates(index, localTasks, backlogDir, toRef),
			);
		};

		const loadTask = (commit: string, path: string) => this.loadCachedTask(commit, path);
		const hydrationResults = await Promise.all([
			hydrateTasks(candidatesFor(remoteIndex, "remote"), { source: "remote", loadTask }),
			hydrateTasks(candidatesFor(localIndex, "local-branch"), {
				source: "local-branch",
				loadTask,
			}),
		]);
		return {
			entries: stateEntries,
			complete: complete && hydrationResults.every(Boolean),
		};
	}

	private async getPinnedBranchRefs(
		tips: readonly GitBranchTip[],
		userConfig: BacklogConfig | null,
		snapshotCurrentBranch?: string,
	): Promise<PinnedBranchRef[]> {
		const isRemote = (name: string) => {
			const normalized = name.trim().replace(/^refs\/remotes\//, "");
			return normalized.startsWith("origin/");
		};
		const currentTip = tips.find((tip) => tip.current && !isRemote(tip.name));
		const currentBranch = currentTip?.name ?? snapshotCurrentBranch ?? (await this.git.getCurrentBranch()).trim();
		const refs: PinnedBranchRef[] = [];
		const seen = new Set<string>();

		for (const tip of tips) {
			let branchRef: PinnedBranchRef | null = null;
			if (isRemote(tip.name)) {
				if (userConfig?.remoteOperations === false) continue;
				const branch = normalizeRemoteBranch(tip.name);
				if (branch) {
					branchRef = { branch, ref: `origin/${branch}`, commit: tip.commit, source: "remote" };
				}
			} else if (currentBranch && !tip.current) {
				const branch = normalizeLocalBranch(tip.name, currentBranch);
				if (branch) branchRef = { branch, ref: branch, commit: tip.commit, source: "local-branch" };
			}

			if (!branchRef) continue;
			const key = `${branchRef.source}\0${branchRef.ref}\0${branchRef.commit}`;
			if (seen.has(key)) continue;
			seen.add(key);
			refs.push(branchRef);
		}
		return refs;
	}

	private commitIndexKey(commit: string, backlogDir: string, prefix: string, cutoff: Date | undefined): string {
		return JSON.stringify([commit, backlogDir, prefix.toLowerCase(), cutoff?.getTime() ?? null]);
	}

	private async loadCommitIndex(
		commit: string,
		backlogDir: string,
		prefix: string,
		historyCutoff: Date | undefined,
	): Promise<readonly CachedTaskTreeEntry[]> {
		const key = this.commitIndexKey(commit, backlogDir, prefix, historyCutoff);
		const cached = this.commitIndexCache.get(key);
		if (cached) return await cached;

		const promise = (async (): Promise<readonly CachedTaskTreeEntry[]> => {
			const files = await this.git.listFilesInTree(commit, backlogDir);
			if (files.length === 0) return [];
			const lastModified = await this.git.getBranchLastModifiedMap(commit, backlogDir, historyCutoff);
			return files.flatMap((path) => {
				const id = extractConfiguredTaskId(path, prefix);
				if (!id) return [];
				return [
					{
						id,
						path,
						type: getTaskTypeFromPath(path, backlogDir),
						lastModified: (lastModified.get(path) ?? new Date(0)).getTime(),
					},
				];
			});
		})();
		this.commitIndexCache.set(key, promise);
		try {
			return await promise;
		} catch (error) {
			if (this.commitIndexCache.get(key) === promise) this.commitIndexCache.delete(key);
			throw error;
		}
	}

	private async loadCachedTask(commit: string, path: string): Promise<Task | null> {
		const key = `${commit}\0${path}`;
		let cached = this.taskCache.get(key);
		if (!cached) {
			const promise = this.git.showFile(commit, path).then((content) => {
				try {
					return normalizeTaskIdentity(parseTask(content));
				} catch (error) {
					console.error(`Failed to parse task ${commit}:${path}`, error);
					return null;
				}
			});
			cached = { commit, promise };
			this.taskCache.set(key, cached);
		}
		try {
			const task = await cached.promise;
			return task ? structuredClone(task) : null;
		} catch (error) {
			if (this.taskCache.get(key)?.promise === cached.promise) this.taskCache.delete(key);
			throw error;
		}
	}
}
