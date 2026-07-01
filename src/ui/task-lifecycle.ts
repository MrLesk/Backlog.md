import { DEFAULT_STATUSES } from "../constants/index.ts";
import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { getTerminalStatus, isTerminalStatus } from "../utils/terminal-status.ts";

export type CompleteTaskFromTuiResult =
	| { success: true }
	| { success: false; reason: "not-terminal"; terminalStatus: string }
	| { success: false; reason: "failed" };

export function formatTaskCompletionBlockedMessage(taskId: string, terminalStatus: string): string {
	return `Task ${taskId} is not ${terminalStatus}. Set status to "${terminalStatus}" before completing it.`;
}

export async function completeTaskFromTui(core: Core, task: Task): Promise<CompleteTaskFromTuiResult> {
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses ?? [...DEFAULT_STATUSES];
	const terminalStatus = getTerminalStatus(statuses) ?? "Done";

	if (!isTerminalStatus(task.status, statuses)) {
		return { success: false, reason: "not-terminal", terminalStatus };
	}

	const success = await core.completeTask(task.id, config?.autoCommit ?? false);
	return success ? { success: true } : { success: false, reason: "failed" };
}
