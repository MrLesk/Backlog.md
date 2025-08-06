/**
 * Helper functions for loading remote tasks in parallel
 */

import { DEFAULT_DIRECTORIES } from "../constants/index.ts";
import type { FileSystem } from "../file-system/operations.ts";
import type { GitOperations as GitOps } from "../git/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { buildRemoteTaskIndex, chooseWinners, hydrateTasks } from "./task-loader.ts";

/**
 * Get the appropriate loading message based on remote operations configuration
 */
export function getTaskLoadingMessage(config: BacklogConfig | null): string {
	return config?.remoteOperations === false
		? "Loading tasks from local branches..."
		: "Loading tasks from local and remote branches...";
}

// TaskWithMetadata is now just an alias for Task (for backward compatibility)
export type TaskWithMetadata = Task;

interface RemoteTaskLoadResult {
	task: TaskWithMetadata;
	error?: never;
}

interface RemoteTaskLoadError {
	task?: never;
	error: Error;
	file: string;
	branch: string;
}

type RemoteTaskResult = RemoteTaskLoadResult | RemoteTaskLoadError;

/**
 * Load all remote tasks using optimized index-first, hydrate-later pattern
 * Dramatically reduces git operations by only fetching content for tasks that need it
 */
export async function loadRemoteTasks(
	gitOps: GitOps,
	fs: FileSystem,
	userConfig: BacklogConfig | null = null,
	onProgress?: (message: string) => void,
	localTasks?: Task[], // Optional: provide local tasks to optimize loading
): Promise<TaskWithMetadata[]> {
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
		const remoteIndex = await buildRemoteTaskIndex(gitOps, branches, backlogDir, days);

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
			const statuses = userConfig?.statuses || ["To Do", "In Progress", "Done"];
			const strategy = userConfig?.taskResolutionStrategy || "most_progressed";

			// Only hydrate remote tasks that are newer or missing locally
			winners = chooseWinners(localById, remoteIndex, statuses, strategy);
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
export function resolveTaskConflict(
	existing: TaskWithMetadata,
	incoming: TaskWithMetadata,
	statuses: string[],
	strategy: "most_recent" | "most_progressed" = "most_progressed",
): TaskWithMetadata {
	if (strategy === "most_recent") {
		// First try to use updated_date from the task metadata
		const existingDate = existing.updatedDate ? new Date(existing.updatedDate) : existing.lastModified;
		const incomingDate = incoming.updatedDate ? new Date(incoming.updatedDate) : incoming.lastModified;

		if (existingDate && incomingDate) {
			return existingDate >= incomingDate ? existing : incoming;
		}
		// If we can't compare dates, fall back to most_progressed
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

	// If statuses are equal and we have dates, use the most recent
	if (newRank === currentRank) {
		const existingDate = existing.updatedDate ? new Date(existing.updatedDate) : existing.lastModified;
		const incomingDate = incoming.updatedDate ? new Date(incoming.updatedDate) : incoming.lastModified;

		if (existingDate && incomingDate) {
			return existingDate >= incomingDate ? existing : incoming;
		}
	}

	return existing;
}
