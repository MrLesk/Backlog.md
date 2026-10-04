import type { ScreenInterface } from "neo-neo-bblessed";
import type { Core } from "../core/backlog.ts";
import { isLocalEditableTask, type Task } from "../types/index.ts";
import { openCommentComposer } from "./components/comment-composer.ts";

// The last author used in this TUI session prefills the next comment's author field.
let lastCommentAuthor = "";

/**
 * Add a comment to a task from the TUI (the "O" shortcut): opens the comment composer and
 * appends through the same update path as `backlog task edit --comment`. Reports the outcome
 * through `notify` (blessed markup) and returns the updated task when a comment was added.
 */
export async function commentOnTaskFromTui(
	core: Core,
	screen: ScreenInterface,
	task: Task,
	notify: (message: string) => void,
): Promise<Task | null> {
	if (!isLocalEditableTask(task) || task.branch) {
		const branchInfo = task.branch ? ` from branch "${task.branch}"` : "";
		notify(` {red-fg}Cannot comment on task${branchInfo}.{/}`);
		return null;
	}
	const updated = await openCommentComposer({
		screen,
		task,
		author: lastCommentAuthor,
		persist: (comment) => core.editTask(task.id, { appendComments: [comment] }),
	});
	if (!updated) return null;
	const latest = updated.comments?.at(-1);
	lastCommentAuthor = latest?.author ?? "";
	notify(` {green-fg}Comment #${latest?.index ?? ""} added to ${updated.id}.{/}`);
	return updated;
}
