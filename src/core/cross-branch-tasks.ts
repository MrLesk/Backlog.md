/**
 * Cross-branch task state resolution
 * Determines the latest state of tasks across all git branches
 */

import type { Task } from "../types/index.ts";
import type { GitOps } from "./git-ops.ts";

export type TaskDirectoryType = "task" | "draft" | "archived";

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
	taskIds: string[],
	onProgress?: (message: string) => void,
): Promise<Map<string, TaskDirectoryInfo>> {
	const taskDirectories = new Map<string, TaskDirectoryInfo>();

	if (taskIds.length === 0) {
		return taskDirectories;
	}

	try {
		// Get all branches
		const branches = await gitOps.listAllBranches();
		if (branches.length === 0) {
			return taskDirectories;
		}

		onProgress?.(`Checking ${taskIds.length} tasks across ${branches.length} branches...`);

		// Get configurable backlog directory
		const config = await fs.loadConfig();
		const backlogDir = config?.backlogDirectory || "backlog";

		// Create all file path combinations we need to check
		const directoryChecks: Array<{ path: string; type: TaskDirectoryType }> = [
			{ path: `${backlogDir}/tasks`, type: "task" },
			{ path: `${backlogDir}/drafts`, type: "draft" },
			{ path: `${backlogDir}/archive/tasks`, type: "archived" },
		];

		// Flatten all checks into a single array for maximum parallelization
		const allChecks: Array<{
			branch: string;
			taskId: string;
			type: TaskDirectoryType;
			filePath: string;
		}> = [];

		for (const branch of branches) {
			for (const taskId of taskIds) {
				// Extract numeric part for filename
				const match = taskId.match(/task-([\d.]+)/);
				if (!match) continue;

				for (const { path, type } of directoryChecks) {
					allChecks.push({
						branch,
						taskId,
						type,
						filePath: `${path}/${taskId}`,
					});
				}
			}
		}

		// Process all checks in parallel with batching to avoid overwhelming git
		const BATCH_SIZE = 50;
		const results: (TaskDirectoryInfo | null)[] = [];

		for (let i = 0; i < allChecks.length; i += BATCH_SIZE) {
			const batch = allChecks.slice(i, i + BATCH_SIZE);
			const batchPromises = batch.map(async ({ branch, taskId, type, filePath }) => {
				try {
					// First check if file exists by listing files in the directory
					const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
					const files = await gitOps.listFilesInTree(branch, dirPath);

					// Find the actual file (might have different casing or title)
					// Extract filename from full path for matching
					const actualFile = files.find((f) => {
						const filename = f.substring(f.lastIndexOf("/") + 1);
						return filename.match(new RegExp(`^${taskId}\\b`));
					});
					if (!actualFile) return null;

					// The actualFile already includes the full path from listFilesInTree
					const lastModified = await gitOps.getFileLastModifiedTime(branch, actualFile);
					if (!lastModified) return null;

					return {
						taskId,
						type,
						lastModified,
						branch,
						path: actualFile,
					};
				} catch {
					return null;
				}
			});

			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);
		}

		// Process results to find the latest directory location for each task
		for (const directoryInfo of results) {
			if (!directoryInfo) continue;

			const existing = taskDirectories.get(directoryInfo.taskId);
			if (!existing || directoryInfo.lastModified > existing.lastModified) {
				taskDirectories.set(directoryInfo.taskId, directoryInfo);
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
 * Only returns tasks whose latest directory type is "task" (not draft or archived)
 */
export function filterTasksByLatestState(tasks: Task[], latestDirectories: Map<string, TaskDirectoryInfo>): Task[] {
	return tasks.filter((task) => {
		const latestDirectory = latestDirectories.get(task.id);

		// If we don't have directory info, assume it's an active task
		if (!latestDirectory) {
			return true;
		}

		// Only show tasks whose latest directory type is "task" (in {backlogDir}/tasks/)
		return latestDirectory.type === "task";
	});
}
