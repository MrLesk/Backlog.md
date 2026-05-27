import type { BoardColumnConfig, BoardConfig, CardConfig } from "../types/index.ts";

/**
 * Build the next `BoardConfig` after a columns-only edit, preserving any
 * sibling `card` config from the previous board. Returns `undefined`
 * when the resulting board has no overrides at all (clean default).
 *
 * `columns === undefined` means "no columns override" (clears the
 * columns field); `columns === []` is the explicit "hide every column"
 * state per Task #4's contract and is preserved verbatim.
 */
export function mergeBoardWithColumns(
	prev: BoardConfig | undefined,
	columns: BoardColumnConfig[] | undefined,
): BoardConfig | undefined {
	const next: BoardConfig = {};
	if (prev?.card !== undefined) next.card = prev.card;
	if (columns !== undefined) next.columns = columns;
	return collapseIfEmpty(next);
}

/**
 * Build the next `BoardConfig` after a card-only edit, preserving any
 * sibling `columns` config from the previous board. Returns `undefined`
 * when the resulting board has no overrides at all.
 *
 * `card === undefined` clears the card override; otherwise the provided
 * card is taken verbatim (including an explicitly empty hide list,
 * though callers should normalize that to `undefined` first so the
 * on-disk config stays clean).
 */
export function mergeBoardWithCard(prev: BoardConfig | undefined, card: CardConfig | undefined): BoardConfig | undefined {
	const next: BoardConfig = {};
	if (prev?.columns !== undefined) next.columns = prev.columns;
	if (card !== undefined) next.card = card;
	return collapseIfEmpty(next);
}

function collapseIfEmpty(board: BoardConfig): BoardConfig | undefined {
	if (board.columns === undefined && board.card === undefined) return undefined;
	return board;
}
