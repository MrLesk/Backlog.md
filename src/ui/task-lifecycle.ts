import { DEFAULT_STATUSES } from "../constants/index.ts";
import type { Core } from "../core/backlog.ts";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { formatDependencyCleanupMessage } from "../utils/dependency-graph.ts";
import { getTerminalStatus, isTerminalStatus } from "../utils/terminal-status.ts";

export type CompleteTaskFromTuiResult =
	| { success: true }
	| { success: false; reason: "not-terminal"; terminalStatus: string }
	| { success: false; reason: "failed" };

/**
 * Transient TUI line for a finished archive: the confirmation, plus the shared cleanup report
 * when other records lost a reference to the archived ID.
 */
export function formatTaskArchivedMessage(taskId: string, cleanedTaskIds: readonly string[]): string {
	const cleanup = formatDependencyCleanupMessage(taskId, cleanedTaskIds);
	return `Archived ${taskId}${cleanup ? `. ${cleanup}` : ""}`;
}

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

export async function createTaskFromTui(
	core: Core,
	input: TaskCreateInput,
	onCreated?: (task: Task) => Promise<void> | void,
): Promise<Task> {
	const config = await core.filesystem.loadConfig();
	const task = (await core.createTaskFromInput(input, config?.autoCommit ?? false)).task;
	if (task.status.trim().toLowerCase() !== "draft") await onCreated?.(task);
	return task;
}

export function upsertTask(tasks: readonly Task[], task: Task): Task[] {
	const existingIndex = tasks.findIndex((candidate) => candidate.id === task.id);
	if (existingIndex === -1) return [...tasks, task];
	const next = [...tasks];
	next[existingIndex] = task;
	return next;
}

export function getCreatedTaskOutcome(
	task: Task,
	visible: boolean,
	view: "board" | "list",
): { focusTaskId?: string; message: string; tone: "green" | "yellow" } {
	if (task.status.trim().toLowerCase() === "draft") {
		return {
			message: `Created ${task.id} as a draft. Drafts are not shown ${view === "board" ? "on the task board" : "in the task list"}.`,
			tone: "yellow",
		};
	}
	if (!visible) {
		return {
			message: `Created ${task.id}, but it is hidden by the current ${view === "board" ? "board" : "task list"} filters.`,
			tone: "yellow",
		};
	}
	return { focusTaskId: task.id, message: `Created ${task.id}.`, tone: "green" };
}
