import type { Task } from "../types/index.ts";
import { wrapStatusColor } from "./status-icon.ts";

function isInProgress(status: string): boolean {
	return status.trim().toLowerCase() === "in progress";
}

/**
 * The TUI's established completion semantics (see status-icon.ts / priority dots):
 * green means done, yellow means underway, red means barely started.
 */
function completionColor(checked: number, total: number): string {
	if (checked === total) return "green";
	return checked / total <= 1 / 3 ? "red" : "yellow";
}

/**
 * One pie glyph mirrors the web's progress ring in a single cell, leaving the task id and
 * title the rest of the row. These live in the Geometric Shapes block the TUI already
 * renders (● ○ ◒ in status-icon.ts), unlike Block Elements such as U+2588/U+2591, which
 * blessed cannot ACS-route and which blank out on fonts that lack them.
 *
 * The empty and full pies are reserved for the exact counts, so a nearly finished task never
 * reads as complete and a barely started one never reads as untouched.
 */
function pieGlyph(checked: number, total: number): string {
	if (checked === 0) return "○";
	if (checked === total) return "●";
	const ratio = checked / total;
	if (ratio <= 1 / 3) return "◔";
	if (ratio <= 2 / 3) return "◑";
	return "◕";
}

/** Format a " (ac: checked/total)" suffix for plain and MCP task list lines; empty without criteria. */
export function formatAcceptanceCriteriaSummarySuffix(task: Task): string {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (criteria.length === 0) return "";

	const checked = criteria.filter((criterion) => criterion.checked).length;
	return ` (ac: ${checked}/${criteria.length})`;
}

/**
 * Format live acceptance-criteria completion for one-line TUI task summaries: a pie glyph
 * and the checked/total count for In Progress tasks with criteria, empty for every other
 * row. createTaskRowPrefix reserves the column this occupies.
 *
 * The glyph is wrapped in a deliberate blessed color tag and no task-derived text enters
 * the cell, so callers can embed the result in tag-parsed content without escaping.
 */
export function formatAcceptanceCriteriaProgress(task: Task): string {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (!isInProgress(task.status) || criteria.length === 0) return "";

	const checked = criteria.filter((criterion) => criterion.checked).length;
	const color = completionColor(checked, criteria.length);

	return `${wrapStatusColor(pieGlyph(checked, criteria.length), color)} ${checked}/${criteria.length}`;
}
