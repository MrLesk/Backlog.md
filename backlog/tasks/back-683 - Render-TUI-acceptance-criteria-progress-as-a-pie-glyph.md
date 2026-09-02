---
id: BACK-683
title: Render TUI acceptance-criteria progress as a pie glyph
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-02 21:40'
updated_date: '2026-09-02 22:27'
labels: []
dependencies: []
ordinal: 315000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI shows acceptance-criteria progress on In Progress rows as an ASCII bar, [###--] 3/5. ASCII was chosen because blessed only guarantees glyph fallback for box-drawing, and Block Elements can render blank or as ? on some fonts. That caution was applied too broadly: the TUI already renders geometric shapes such as ● ○ ◒ ✓ on every supported terminal, and the maintainer had asked for Unicode, not ASCII. The bar also sits before the task ID on In Progress rows only, so IDs do not line up across rows.

Replace the bar with a single pie glyph from the same Unicode block as the shapes already in use, so it mirrors the radial ring the web shows and costs one cell: ○ for nothing checked, ◔ up to a third, ◑ up to two thirds, ◕ above that, ● when every criterion is checked, followed by the checked/total count. Keep the existing color semantics on the glyph (green when complete, yellow underway, red when a third or less). The wide and compact variants collapse into one form. Reserve the indicator column on every row so task IDs align whether or not a row shows progress. Which rows show progress is unchanged: In Progress tasks with criteria.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In Progress rows with criteria show a pie glyph (○ ◔ ◑ ◕ ●) and the checked/total count instead of the ASCII bar, on the board and in the task list
- [ ] #2 The glyph keeps the existing color semantics: green when all criteria are checked, yellow when underway, red when a third or fewer are checked
- [ ] #3 Task IDs align across rows because the indicator column is reserved on rows without progress
- [ ] #4 The glyphs render at the correct width in the TUI, verified with the existing width test infrastructure, and no Block Elements are introduced
- [ ] #5 Plain and MCP list output are unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the ASCII bar in src/ui/acceptance-criteria-progress.ts with a single pie glyph (U+25CB/25D4/25D1/25D5/25CF) plus the checked/total count. Glyph thresholds: nothing checked -> circle, <= 1/3 -> quarter, <= 2/3 -> half, above that but incomplete -> three-quarter, all checked -> full. Keep the existing wrapStatusColor semantics (green complete, yellow underway, red at a third or fewer). No Block Elements.
2. Turn the formatter into a fixed-width column that every row gets, including the separator before the task id: blanks when a row shows no progress. Drop the wide/compact variants and the now-unused availableWidth plumbing from both row formatters.
3. Board (src/ui/board.ts formatTaskListItem): prefix every row with the reserved column so ids line up across rows and columns; verify the moving marker and cross-branch dimming still compose.
4. Task list (src/ui/task-viewer-with-search.ts formatTaskViewerListItem): use the same reserved column; make the status segment a uniform-width icon so ids actually line up (the BACK-551 conditional swapped between icon-only and icon+status-word, which is variable width).
5. Verify the five glyphs measure one cell in the patched neo-neo-bblessed width table using the same unicode.strWidth infrastructure as src/test/tui-emoji-width.test.ts.
6. Rewrite src/test/tui-acceptance-criteria-progress.test.ts for the new output: each glyph threshold, the color at each threshold, id alignment between a row with progress and a row without, and cell width. Leave the plain/MCP suffix test untouched.
7. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the ASCII bar with a single pie glyph plus the live checked/total count, in src/ui/acceptance-criteria-progress.ts. Thresholds: ○ nothing checked, ◔ up to a third, ◑ up to two thirds, ◕ above that, ● only when every criterion is checked. ○ and ● are reserved for the exact counts, which replaces the old rounding clamps. Colors are unchanged (green complete, yellow underway, red at a third or fewer), so ○/◔ are red, ◑/◕ yellow and ● green.

The formatter is now formatAcceptanceCriteriaProgressColumn and returns a fixed 8-column field for every row, blanks included, with the separator before the task id. 8 fits '● 99/99', so ids stay aligned for any checklist length a person would review. The wide/compact variants and the availableWidth plumbing behind them are gone from both row formatters, buildRenderedTaskListItems and getTaskListSummaryWidth.

The reserved column is emitted before the row-level color tags on both surfaces. blessed treats a bare {/} as a full attribute reset (Element.prototype._parseTags), so the glyph's own close tag used to cancel the magenta move highlight and the gray cross-branch dim for the rest of the row; keeping the column outside those tags fixes that and holds the leftmost column still while a task moves.

In the task list the status segment is now always the single-cell icon. It previously swapped between the icon and 'icon + status word', which is variable width, so ids could not line up. Flagged in the PR for review since it removes the status word from rows that are not In Progress.

Verified in a real PTY at 150x40 with expect (board and task list): the five glyphs render single-cell and every task id lines up, including a 10/13 row and rows with no criteria. blessed only degrades non-ASCII to '?' when the locale is not UTF-8 (Tput.detectUnicode), which already applies to the shipped ◒ ○ ✔ status icons, so the pies introduce no new exposure. neo-neo-bblessed unicode.strWidth reports 1 for all five, same as the ● already in use, and no Block Elements are used.
<!-- SECTION:NOTES:END -->
