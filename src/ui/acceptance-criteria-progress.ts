import type { Task } from "../types/index.ts";
import { wrapStatusColor } from "./status-icon.ts";

// A compact indicator leaves the task id and title most of the row; the color of the
// filled run carries the completion signal that the dropped cells used to spell out.
const WIDE_PROGRESS_MIN_WIDTH = 40;
const WIDE_PROGRESS_CELLS = 5;
const COMPACT_PROGRESS_CELLS = 3;

// Plain ASCII on purpose: blessed only guarantees glyph fallback for DEC Special
// Graphics (box drawing), so Block Elements like U+2588/U+2591 render as blank
// cells when the terminal font lacks them and as "?" without a UTF-8 locale.
// ASCII stays below "~" and bypasses every charset translation.
const FILLED_CELL = "#";
const EMPTY_CELL = "-";

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

/** Format a " (ac: checked/total)" suffix for plain and MCP task list lines; empty without criteria. */
export function formatAcceptanceCriteriaSummarySuffix(task: Task): string {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (criteria.length === 0) return "";

	const checked = criteria.filter((criterion) => criterion.checked).length;
	return ` (ac: ${checked}/${criteria.length})`;
}

/**
 * Format live acceptance-criteria completion for one-line TUI task summaries.
 *
 * The filled run is wrapped in a deliberate blessed color tag; no task-derived text
 * enters the bar, so callers embed the result in tag-parsed content without escaping.
 */
export function formatAcceptanceCriteriaProgress(task: Task, availableWidth = Number.POSITIVE_INFINITY): string {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (!isInProgress(task.status) || criteria.length === 0) return "";

	const checked = criteria.filter((criterion) => criterion.checked).length;
	const cells = availableWidth >= WIDE_PROGRESS_MIN_WIDTH ? WIDE_PROGRESS_CELLS : COMPACT_PROGRESS_CELLS;
	// Clamp rounding so any progress shows at least one cell and unfinished work never fills the bar.
	let filled = Math.round((checked / criteria.length) * cells);
	if (checked > 0 && filled === 0) filled = 1;
	if (checked < criteria.length && filled === cells) filled = cells - 1;

	const filledRun =
		filled > 0 ? wrapStatusColor(FILLED_CELL.repeat(filled), completionColor(checked, criteria.length)) : "";

	return `[${filledRun}${EMPTY_CELL.repeat(cells - filled)}] ${checked}/${criteria.length}`;
}
