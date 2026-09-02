import type { Task } from "../types/index.ts";
import { wrapStatusColor } from "./status-icon.ts";

// Every row reserves this column so task ids line up whether or not the row shows
// progress. It holds "● 99/99" plus the separator before the id, which covers any
// checklist a person can review; a longer count pushes its own row right rather than
// losing a digit.
const PROGRESS_COLUMN_WIDTH = 8;

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
 * Format the acceptance-criteria column that precedes the task id in one-line TUI summaries.
 *
 * In Progress tasks with criteria get a pie glyph and their live checked/total count; every
 * other row gets the same width in blanks so ids stay aligned down the list. The glyph is
 * wrapped in a deliberate blessed color tag and no task-derived text enters the column, so
 * callers can embed the result in tag-parsed content without escaping.
 */
export function formatAcceptanceCriteriaProgressColumn(task: Task): string {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (!isInProgress(task.status) || criteria.length === 0) return " ".repeat(PROGRESS_COLUMN_WIDTH);

	const checked = criteria.filter((criterion) => criterion.checked).length;
	const glyph = pieGlyph(checked, criteria.length);
	const count = `${checked}/${criteria.length}`;
	// Pad on the rendered text, not the tagged string, and always keep one separator column.
	const padding = " ".repeat(Math.max(1, PROGRESS_COLUMN_WIDTH - `${glyph} ${count}`.length));

	return `${wrapStatusColor(glyph, completionColor(checked, criteria.length))} ${count}${padding}`;
}
