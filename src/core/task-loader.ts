/**
 * Optimized task loading with index-first, hydrate-later pattern
 * Dramatically reduces git operations for multi-branch task loading
 */

import type { FileSystem } from "../file-system/operations.ts";
import type { GitOperations } from "../git/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { Task } from "../types/index.ts";

export interface RemoteIndexEntry {
	id: string;
	branch: string;
	path: string; // "backlog/tasks/task-123 - title.md"
	lastModified: Date;
}

/**
 * Build a cheap index of remote tasks without fetching content
 * This is VERY fast as it only lists files and gets modification times in batch
 */
export async function buildRemoteTaskIndex(
	git: GitOperations,
	branches: string[],
	backlogDir = "backlog",
): Promise<Map<string, RemoteIndexEntry[]>> {
	const out = new Map<string, RemoteIndexEntry[]>();

	// Do branches in parallel but not unbounded
	const CONCURRENCY = 4;
	const queue = [...branches];

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
				const lm = await git.getBranchLastModifiedMap(ref, `${backlogDir}/tasks`);

				for (const f of files) {
					// Extract task ID from filename
					const m = f.match(/task-(\d+)/);
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
	fs: FileSystem,
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
					(task as any).source = "remote";
					// Extract branch name from ref (e.g., "origin/main" -> "main")
					const branch = w.ref.replace("origin/", "");
					(task as any).branch = branch;
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
 * Choose which remote tasks need to be hydrated based on strategy
 * Returns only the tasks that are newer or more progressed than local versions
 */
export function chooseWinners(
	localById: Map<string, Task>,
	remoteIndex: Map<string, RemoteIndexEntry[]>,
	statuses: string[],
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
 * Build index for completed tasks directory
 */
export async function buildCompletedTaskIndex(
	git: GitOperations,
	branches: string[],
	backlogDir = "backlog",
): Promise<Map<string, RemoteIndexEntry[]>> {
	const out = new Map<string, RemoteIndexEntry[]>();

	// Similar to buildRemoteTaskIndex but for completed directory
	const CONCURRENCY = 4;
	const queue = [...branches];

	const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
		while (queue.length) {
			const br = queue.pop();
			if (!br) break;

			const ref = `origin/${br}`;

			try {
				// Check completed directory
				const files = await git.listFilesInTree(ref, `${backlogDir}/completed`);
				if (files.length === 0) continue;

				const lm = await git.getBranchLastModifiedMap(ref, `${backlogDir}/completed`);

				for (const f of files) {
					const m = f.match(/task-(\d+)/);
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
			} catch {
				// Directory might not exist
			}
		}
	});

	await Promise.all(workers);
	return out;
}
