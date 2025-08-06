/**
 * Cross-branch task state resolution
 * Determines the latest state of tasks across all git branches
 */

import { DEFAULT_DIRECTORIES } from "../constants/index.ts";
import type { FileSystem } from "../file-system/operations.ts";
import type { GitOperations as GitOps } from "../git/operations.ts";
import type { Task } from "../types/index.ts";

export type TaskDirectoryType = "task" | "draft" | "archived" | "completed";

export interface TaskDirectoryInfo {
	taskId: string;
	type: TaskDirectoryType;
	lastModified: Date;
	branch: string;
	path: string;
}

/**
 * Get the latest directory location of specific task IDs across all branches
 * Only checks the provided task IDs for optimal performance
 */
export async function getLatestTaskStatesForIds(
	gitOps: GitOps,
	_filesystem: FileSystem,
	taskIds: string[],
	onProgress?: (message: string) => void,
	options?: { recentBranchesOnly?: boolean; daysAgo?: number },
): Promise<Map<string, TaskDirectoryInfo>> {
	const taskDirectories = new Map<string, TaskDirectoryInfo>();

	if (taskIds.length === 0) {
		return taskDirectories;
	}

	try {
		// Get branches - use recent branches by default for performance
		const useRecentOnly = options?.recentBranchesOnly ?? true;
		const daysAgo = options?.daysAgo ?? 9999; // Use config default

		let branches = useRecentOnly ? await gitOps.listRecentBranches(daysAgo) : await gitOps.listAllBranches();

		if (branches.length === 0) {
			return taskDirectories;
		}

		// Use standard backlog directory
		const backlogDir = DEFAULT_DIRECTORIES.BACKLOG;

		// Filter branches that actually have backlog changes
		const branchesWithBacklog: string[] = [];

		// Quick check which branches actually have the backlog directory
		for (const branch of branches) {
			try {
				// Just check if the backlog directory exists
				const files = await gitOps.listFilesInTree(branch, backlogDir);
				if (files.length > 0) {
					branchesWithBacklog.push(branch);
				}
			} catch {
				// Branch doesn't have backlog directory
			}
		}

		// Use filtered branches
		branches = branchesWithBacklog;

		// Count local vs remote branches for info
		const localBranches = branches.filter((b) => !b.includes("origin/"));
		const remoteBranches = branches.filter((b) => b.includes("origin/"));

		const branchMsg = useRecentOnly
			? `${branches.length} branches with backlog (from ${daysAgo} days, ${localBranches.length} local, ${remoteBranches.length} remote)`
			: `${branches.length} branches with backlog (${localBranches.length} local, ${remoteBranches.length} remote)`;
		onProgress?.(`Checking ${taskIds.length} tasks across ${branchMsg}...`);

		// Create all file path combinations we need to check
		const directoryChecks: Array<{ path: string; type: TaskDirectoryType }> = [
			{ path: `${backlogDir}/tasks`, type: "task" },
			{ path: `${backlogDir}/drafts`, type: "draft" },
			{ path: `${backlogDir}/archive/tasks`, type: "archived" },
			{ path: `${backlogDir}/completed`, type: "completed" },
		];

		// For better performance, prioritize checking current branch and main branch first
		const priorityBranches = ["main", "master"];
		const currentBranch = await gitOps.getCurrentBranch();
		if (currentBranch && !priorityBranches.includes(currentBranch)) {
			priorityBranches.unshift(currentBranch);
		}

		// Check priority branches first
		for (const branch of priorityBranches) {
			if (!branches.includes(branch)) continue;

			// Remove from main list to avoid duplicate checking
			branches = branches.filter((b) => b !== branch);

			// Quick check for all tasks in this branch
			for (const { path, type } of directoryChecks) {
				try {
					const files = await gitOps.listFilesInTree(branch, path);
					if (files.length === 0) continue;

					// Get all modification times in one pass
					const modTimes = await gitOps.getBranchLastModifiedMap(branch, path);

					// Build file->id map for O(1) lookup
					const fileToId = new Map<string, string>();
					for (const f of files) {
						const filename = f.substring(f.lastIndexOf("/") + 1);
						const match = filename.match(/^(task-\d+(?:\.\d+)?)/);
						if (match?.[1]) {
							fileToId.set(match[1], f);
						}
					}

					// Check each task ID
					for (const taskId of taskIds) {
						const taskFile = fileToId.get(taskId);

						if (taskFile) {
							const lastModified = modTimes.get(taskFile);
							if (lastModified) {
								const existing = taskDirectories.get(taskId);
								if (!existing || lastModified > existing.lastModified) {
									taskDirectories.set(taskId, {
										taskId,
										type,
										lastModified,
										branch,
										path: taskFile,
									});
								}
							}
						}
					}
				} catch {
					// Skip directories that don't exist
				}
			}
		}

		// If we found all tasks in priority branches, we can skip other branches
		if (taskDirectories.size === taskIds.length) {
			onProgress?.(`Found all ${taskIds.length} tasks in priority branches`);
			return taskDirectories;
		}

		// For remaining tasks, check other branches
		const remainingTaskIds = taskIds.filter((id) => !taskDirectories.has(id));
		if (remainingTaskIds.length === 0 || branches.length === 0) {
			onProgress?.(`Checked ${taskIds.length} tasks`);
			return taskDirectories;
		}

		onProgress?.(`Checking ${remainingTaskIds.length} remaining tasks across ${branches.length} branches...`);

		// Check remaining branches in parallel batches
		const BRANCH_BATCH_SIZE = 5; // Process 5 branches at a time for better performance
		for (let i = 0; i < branches.length; i += BRANCH_BATCH_SIZE) {
			const branchBatch = branches.slice(i, i + BRANCH_BATCH_SIZE);

			await Promise.all(
				branchBatch.map(async (branch) => {
					for (const { path, type } of directoryChecks) {
						try {
							const files = await gitOps.listFilesInTree(branch, path);

							if (files.length === 0) continue;

							// Get all modification times in one pass
							const modTimes = await gitOps.getBranchLastModifiedMap(branch, path);

							// Build file->id map for O(1) lookup
							const fileToId = new Map<string, string>();
							for (const f of files) {
								const filename = f.substring(f.lastIndexOf("/") + 1);
								const match = filename.match(/^(task-\d+(?:\.\d+)?)/);
								if (match?.[1]) {
									fileToId.set(match[1], f);
								}
							}

							for (const taskId of remainingTaskIds) {
								// Skip if we already found this task
								if (taskDirectories.has(taskId)) continue;

								const taskFile = fileToId.get(taskId);

								if (taskFile) {
									const lastModified = modTimes.get(taskFile);
									if (lastModified) {
										const existing = taskDirectories.get(taskId);
										if (!existing || lastModified > existing.lastModified) {
											taskDirectories.set(taskId, {
												taskId,
												type,
												lastModified,
												branch,
												path: taskFile,
											});
										}
									}
								}
							}
						} catch {
							// Skip directories that don't exist
						}
					}
				}),
			);

			// Early exit if we found all tasks
			if (taskDirectories.size === taskIds.length) {
				break;
			}
		}

		onProgress?.(`Checked ${taskIds.length} tasks`);
	} catch (error) {
		console.error("Failed to get task directory locations for IDs:", error);
	}

	return taskDirectories;
}

/**
 * Filter tasks based on their latest directory location across all branches
 * Only returns tasks whose latest directory type is "task" or "completed" (not draft or archived)
 */
export function filterTasksByLatestState(tasks: Task[], latestDirectories: Map<string, TaskDirectoryInfo>): Task[] {
	return tasks.filter((task) => {
		const latestDirectory = latestDirectories.get(task.id);

		// If we don't have directory info, assume it's an active task
		if (!latestDirectory) {
			return true;
		}

		// Show tasks whose latest directory type is "task" or "completed"
		return latestDirectory.type === "task" || latestDirectory.type === "completed";
	});
}
