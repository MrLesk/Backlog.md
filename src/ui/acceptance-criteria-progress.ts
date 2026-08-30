import type { Task } from "../types/index.ts";

// A 10-cell indicator occupies about half this width, leaving room for task identity and title.
// Keep enough room for the task identity and a meaningful title after the indicator.
const WIDE_PROGRESS_MIN_WIDTH = 40;
const WIDE_PROGRESS_CELLS = 10;
const COMPACT_PROGRESS_CELLS = 5;

// Plain ASCII on purpose: blessed only guarantees glyph fallback for DEC Special
// Graphics (box drawing), so Block Elements like U+2588/U+2591 render as blank
// cells when the terminal font lacks them and as "?" without a UTF-8 locale.
// ASCII stays below "~" and bypasses every charset translation.
const FILLED_CELL = "#";
const EMPTY_CELL = "-";

function isInProgress(status: string): boolean {
	return status.trim().toLowerCase() === "in progress";
}

/** Format live acceptance-criteria completion for one-line TUI task summaries. */
export function formatAcceptanceCriteriaProgress(task: Task, availableWidth = Number.POSITIVE_INFINITY): string {
	const criteria = task.acceptanceCriteriaItems ?? [];
	if (!isInProgress(task.status) || criteria.length === 0) return "";

	const checked = criteria.filter((criterion) => criterion.checked).length;
	const cells = availableWidth >= WIDE_PROGRESS_MIN_WIDTH ? WIDE_PROGRESS_CELLS : COMPACT_PROGRESS_CELLS;
	const filled = Math.round((checked / criteria.length) * cells);

	return `[${FILLED_CELL.repeat(filled)}${EMPTY_CELL.repeat(cells - filled)}] ${checked}/${criteria.length}`;
}
