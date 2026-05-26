import type { BacklogConfig, BoardColumnConfig } from "../types/index.ts";

/**
 * Returns the ordered list of columns the kanban board should render.
 *
 * Resolution rules, in order:
 *
 *  1. If `config.board?.columns` is an array (including the empty array),
 *     use it. Filter out entries whose `status` is not present in
 *     `config.statuses` so the board never renders a column for a status
 *     the rest of the system doesn't know about (e.g. a stale config
 *     entry left behind after a status was removed). Honors user-specified
 *     order. **An empty array (or one whose entries all get filtered
 *     out) is preserved as an empty result — that's the user's explicit
 *     "hide every column" intent and must not silently re-expand to the
 *     full status list.**
 *  2. Otherwise (board absent, or board with no `columns` field), derive
 *     one column per entry in `config.statuses` with no color. This is
 *     the back-compat path — output matches Backlog.md's historical
 *     behavior byte-for-byte.
 *
 * Hidden statuses (statuses present in `config.statuses` but absent from
 * `board.columns`) are intentionally NOT included. Tasks in those
 * statuses are still reachable via list views; the board hides their
 * column. See context.md §Task #4 reviewer focus areas.
 */
export function resolveBoardColumns(config: BacklogConfig): BoardColumnConfig[] {
	const configured = config.board?.columns;
	if (Array.isArray(configured)) {
		const validStatuses = new Set(config.statuses);
		const seen = new Set<string>();
		const result: BoardColumnConfig[] = [];
		for (const column of configured) {
			if (!column?.status) continue;
			if (!validStatuses.has(column.status)) continue;
			// Dedupe — same status twice in the array would render two
			// columns sharing tasks, which is never what the user wants.
			if (seen.has(column.status)) continue;
			seen.add(column.status);
			result.push(column.color ? { status: column.status, color: column.color } : { status: column.status });
		}
		return result;
	}
	return config.statuses.map((status) => ({ status }));
}
