import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";

/** The archive confirmation every TUI view shows. Three short lines, to fit the confirm popup. */
export function formatArchiveConfirmation(taskId: string): string {
	return `Archive {bold}${taskId}{/bold}?\nMoves it off the board and keeps\nits ID, record, and links.`;
}

/** Archive a task from a TUI view, honoring the project's auto-commit setting. */
export async function archiveTaskFromTui(core: Core, task: Task): Promise<boolean> {
	const config = await core.fs.loadConfig();
	return await core.archiveTask(task.id, config?.autoCommit ?? false);
}
