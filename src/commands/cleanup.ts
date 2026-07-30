import { basename, join } from "node:path";
import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";

export interface CleanupExecutionResult {
	successCount: number;
	autoCommitEnabled: boolean;
	hasGitRepository: boolean;
	stagedMoves: boolean;
	failures: Array<{ taskId: string; message: string }>;
	stageWarnings: Array<{ taskId: string; error: unknown }>;
}

/** Complete a cleanup batch under one current-byte automatic-commit plan. */
export async function completeTasksForCleanup(core: Core, tasks: readonly Task[]): Promise<CleanupExecutionResult> {
	return core.withAutoCommitPlan(undefined, async () => {
		const autoCommitEnabled = await core.shouldAutoCommit();
		let successCount = 0;
		const failures: CleanupExecutionResult["failures"] = [];
		const movedTasks: Array<{ fromPath: string; toPath: string; taskId: string }> = [];

		for (const task of tasks) {
			const fromPath = task.filePath ?? (await core.getTask(task.id))?.filePath ?? null;
			if (!fromPath) {
				failures.push({ taskId: task.id, message: `Failed to locate file for task ${task.id}` });
				continue;
			}
			const toPath = join(core.filesystem.completedDir, basename(fromPath));
			if (await core.completeTask(task.id)) {
				successCount += 1;
				movedTasks.push({ fromPath, toPath, taskId: task.id });
			} else {
				failures.push({ taskId: task.id, message: `Failed to move task ${task.id}` });
			}
		}

		const hasGitRepository = await core.gitOps.isRepository();
		const stageWarnings: CleanupExecutionResult["stageWarnings"] = [];
		if (successCount > 0 && !autoCommitEnabled && hasGitRepository) {
			for (const move of movedTasks) {
				try {
					await core.gitOps.stageFileMove(move.fromPath, move.toPath);
				} catch (error) {
					stageWarnings.push({ taskId: move.taskId, error });
				}
			}
		}

		return {
			successCount,
			autoCommitEnabled,
			hasGitRepository,
			stagedMoves: successCount > 0 && !autoCommitEnabled && hasGitRepository,
			failures,
			stageWarnings,
		};
	});
}
