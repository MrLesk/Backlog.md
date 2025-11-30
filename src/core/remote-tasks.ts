/**
 * Helper functions for loading remote tasks in parallel
 */

import { DEFAULT_DIRECTORIES } from "../constants/index.ts";
import type { GitOperations as GitOps } from "../git/operations.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { buildLocalBranchTaskIndex, buildRemoteTaskIndex, chooseWinners, hydrateTasks } from "./task-loader.ts";

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

/**
 * Load all remote tasks using optimized index-first, hydrate-later pattern
 * Dramatically reduces git operations by only fetching content for tasks that need it
 */
export async function loadRemoteTasks(
	gitOps: GitOps,
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

/**
 * Load tasks from other local branches (not current branch, not remote)
 * Uses the same optimized index-first, hydrate-later pattern as remote loading
 */
export async function loadLocalBranchTasks(
	gitOps: GitOps,
	userConfig: BacklogConfig | null = null,
	onProgress?: (message: string) => void,
	localTasks?: Task[], // Tasks from current branch filesystem
): Promise<TaskWithMetadata[]> {
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
		const localBranchIndex = await buildLocalBranchTaskIndex(gitOps, localBranches, currentBranch, backlogDir, days);

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
