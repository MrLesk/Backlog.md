/**
 * Helper functions for loading remote tasks in parallel
 */

import type { FileSystem } from "../file-system/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { Task } from "../types/index.ts";
import type { GitOps } from "./git-ops.ts";

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
 * Load all remote tasks in parallel for better performance
 */
export async function loadRemoteTasks(
	gitOps: GitOps,
	fs: FileSystem,
	onProgress?: (message: string) => void,
): Promise<TaskWithMetadata[]> {
	const tasks: TaskWithMetadata[] = [];

	try {
		// Fetch remote branches
		onProgress?.("Fetching remote branches...");
		await gitOps.fetch();
		const branches = await gitOps.listRemoteBranches();

		if (branches.length === 0) {
			return tasks;
		}

		onProgress?.(`Found ${branches.length} remote branches`);

		// Get configurable backlog directory
		const config = await fs.loadConfig();
		const backlogDir = config?.backlogDirectory || "backlog";

		// Process all branches in parallel
		const branchPromises = branches.map(async (branch) => {
			const ref = `origin/${branch}`;

			try {
				// List files in the branch
				const files = await gitOps.listFilesInTree(ref, `${backlogDir}/tasks`);

				if (files.length === 0) {
					return [];
				}

				// Load all files in this branch in parallel
				const filePromises = files.map(async (file): Promise<RemoteTaskResult> => {
					try {
						// Load file content and timestamp in parallel
						const [content, lastModified] = await Promise.all([
							gitOps.showFile(ref, file),
							gitOps.getFileLastModifiedTime(ref, file),
						]);

						const task = parseTask(content);

						return {
							task: {
								...task,
								lastModified: lastModified || undefined,
								source: "remote" as const,
								branch,
							},
						};
					} catch (error) {
						return {
							error: error as Error,
							file,
							branch,
						};
					}
				});

				const results = await Promise.all(filePromises);

				// Extract successful tasks and report errors
				const branchTasks: TaskWithMetadata[] = [];
				for (const result of results) {
					if (result.task) {
						branchTasks.push(result.task);
					} else if (result.error) {
						// Log error but continue processing
						console.error(`Failed to load task from ${result.branch}:${result.file}: ${result.error.message}`);
					}
				}

				onProgress?.(`Loaded ${branchTasks.length} tasks from ${branch}`);
				return branchTasks;
			} catch (error) {
				console.error(`Failed to process branch ${branch}:`, error);
				return [];
			}
		});

		// Wait for all branches to complete
		const branchResults = await Promise.all(branchPromises);

		// Flatten results
		for (const branchTasks of branchResults) {
			tasks.push(...branchTasks);
		}

		onProgress?.(`Loaded ${tasks.length} total remote tasks`);
	} catch (error) {
		// If fetch fails, we can still work with local tasks
		console.error("Failed to fetch remote tasks:", error);
	}

	return tasks;
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
	const currentIdx = statuses.indexOf(existing.status);
	const newIdx = statuses.indexOf(incoming.status);

	// If incoming task has a more progressed status, use it
	if (newIdx > currentIdx || currentIdx === -1) {
		return incoming;
	}

	// If statuses are equal and we have dates, use the most recent
	if (newIdx === currentIdx) {
		const existingDate = existing.updatedDate ? new Date(existing.updatedDate) : existing.lastModified;
		const incomingDate = incoming.updatedDate ? new Date(incoming.updatedDate) : incoming.lastModified;

		if (existingDate && incomingDate) {
			return existingDate >= incomingDate ? existing : incoming;
		}
	}

	return existing;
}
