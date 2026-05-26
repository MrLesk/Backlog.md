import type { BoardConfig } from "../types/index.ts";

/** A single editable row in the Settings → Board Columns table. */
export interface BoardEditorRow {
	status: string;
	color: string | undefined;
	visible: boolean;
}

/**
 * Derive the Settings UI's row list from the (statuses, board) tuple.
 *
 * Contract — must match what the rest of the stack persists/resolves:
 *
 *  - `board === undefined` OR `board.columns === undefined`: no override
 *    is configured. Every status is visible in its declared order.
 *  - `board.columns === []`: explicit hide-all. Every status row is
 *    rendered as hidden (visible: false) so the UI faithfully reflects
 *    what's on disk.
 *  - `board.columns: [valid entries]`: the listed statuses are visible,
 *    in the user's chosen order, with their colors. Statuses present in
 *    `statuses` but absent from the list are appended at the end as
 *    hidden rows (so the user can toggle them back on without manually
 *    re-adding them).
 *
 * The distinction between `undefined` and `[]` is critical — using
 * `configured.length > 0` to decide hidden-by-default would round-trip
 * a saved hide-all state as "all visible" in the editor.
 */
export function buildBoardEditorRows(statuses: string[], board: BoardConfig | undefined): BoardEditorRow[] {
	const configured = board?.columns;
	// Field presence is the signal, NOT length. An empty array means
	// "explicitly hide all", which the editor must round-trip as such.
	const hasConfigured = configured !== undefined;
	const ordered = configured ?? [];
	const seen = new Set<string>();
	const rows: BoardEditorRow[] = [];
	for (const column of ordered) {
		if (!statuses.includes(column.status)) continue;
		if (seen.has(column.status)) continue;
		seen.add(column.status);
		rows.push({ status: column.status, color: column.color, visible: true });
	}
	for (const status of statuses) {
		if (seen.has(status)) continue;
		// Hidden by default when the user has explicitly configured a
		// (possibly empty) board.columns; visible by default otherwise.
		rows.push({ status, color: undefined, visible: !hasConfigured });
	}
	return rows;
}
