import type { Core } from "../core/backlog.ts";
import { isReadOnlyTask, type Task } from "../types/index.ts";
import { taskNotFoundMessage } from "../utils/task-path.ts";

/** The archive confirmation every TUI view shows. Three short lines, to fit the confirm popup. */
export function formatArchiveConfirmation(taskId: string): string {
	return `Archive {bold}${taskId}{/bold}?\nMoves it off the board and keeps\nits ID, record, and links.`;
}

/** The footer line every TUI view shows when a key would change a read-only task. */
export function formatReadOnlyNotice(task: Task): string {
	return ` {red-fg}Task is read-only${task.branch ? ` in branch ${task.branch}` : ""}.{/}`;
}

export interface TuiArchiveResult {
	archived: boolean;
	reason?: "read_only" | "cancelled" | "failed";
	/** Why core refused or failed, when it said so. */
	error?: string;
}

/**
 * Run the archive key for one task. A read-only task is refused before `confirm` is called, so a
 * view asks its question only when core will accept the answer. The archive itself, including
 * whether it is committed, is core's.
 */
export async function archiveTaskFromTui(
	core: Core,
	task: Task,
	confirm: (popup: { title: string; message: string }) => Promise<boolean>,
): Promise<TuiArchiveResult> {
	if (isReadOnlyTask(task)) return { archived: false, reason: "read_only" };
	if (!(await confirm({ title: "Archive Task", message: formatArchiveConfirmation(task.id) }))) {
		return { archived: false, reason: "cancelled" };
	}
	try {
		const archived = await core.archiveTask(task.id);
		return archived ? { archived } : { archived, reason: "failed" };
	} catch (error) {
		return { archived: false, reason: "failed", error: error instanceof Error ? error.message : "Unknown error" };
	}
}

/** The footer line for the outcome of the archive key, or null when the user said no. */
export function formatArchiveNotice(task: Task, result: TuiArchiveResult): string | null {
	if (result.archived) return ` {green-fg}Archived ${task.id}{/}`;
	if (result.reason === "read_only") return formatReadOnlyNotice(task);
	if (result.reason === "cancelled") return null;
	// Core refused or failed after the view's snapshot went stale, so its own reason is shown.
	return result.error
		? ` {red-fg}Error archiving task: ${result.error}{/}`
		: ` {red-fg}${taskNotFoundMessage(task.id)}{/}`;
}
