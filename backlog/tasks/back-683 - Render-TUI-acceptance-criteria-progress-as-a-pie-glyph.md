---
id: BACK-683
title: Render TUI acceptance-criteria progress as a pie glyph
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-02 21:40'
updated_date: '2026-09-02 23:00'
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
- [x] #1 In Progress rows with criteria show a pie glyph (○ ◔ ◑ ◕ ●) and the checked/total count instead of the ASCII bar, on the board and in the task list
- [x] #2 The glyph keeps the existing color semantics: green when all criteria are checked, yellow when underway, red when a third or fewer are checked
- [x] #3 Task IDs align across rows because the indicator column is reserved on rows without progress
- [x] #4 The glyphs render at the correct width in the TUI, verified with the existing width test infrastructure, and no Block Elements are introduced
- [x] #5 Plain and MCP list output are unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

Review follow-up (Codex findings on PR #996), both resolved by one change rather than two patches.

Finding 1 (custom statuses): dropping the status word from the task list made every status outside the six getStatusStyle entries render as the same default ○ and color. Reproduced before the fix: 'Ready', 'Waiting', 'Blocked on review' and 'To Do' all rendered the identical row '○         BACK-1 - Title'. The word is load-bearing, so the list shows icon + status word on every row again, unconditionally.

Finding 2 (three-digit counts): the fixed 8-column reserve overflowed for larger checklists. Reproduced before the fix: 10/100 needed 9 cells and 100/100 needed 10, so those ids sat at columns 9 and 10 while every other row sat at 8.

Both come from a fixed constant, so the constant is gone. New src/ui/task-row-prefix.ts builds the prefix per render: a status segment (task list only; board columns already name the status) then the progress cell, each padded to the widest of its kind across the rows actually being rendered. Ids line up, custom statuses keep their label, three-digit counts fit, and a render pays only for columns something on it fills. A board column where no row has criteria now has no gutter at all, and a list with only single-digit counts spends nothing on the three-digit case. Widths are measured with the same neo-neo-bblessed unicode.strWidth the layout uses, not string length, so a non-ASCII status label pads correctly.

acceptance-criteria-progress.ts is back to formatAcceptanceCriteriaProgress(task) returning the bare tagged cell or an empty string; all reservation lives in the prefix builder. The prefix is still emitted before the row-level move/dim tags, so the highlight and cross-branch dim survive the whole row.

The board formatter and the task-list formatter take the prefix builder as a last parameter, defaulting to a single-row builder so standalone calls still render sensibly. The task list rebuilds it wherever filteredTasks is assigned, so the render stays O(n).

Verified: 13 tests in src/test/tui-acceptance-criteria-progress.test.ts, including a render mixing custom statuses, 100/100, 10/100 and rows without progress that asserts one id column for all of them, a test that Ready and Waiting stay distinguishable, a test that an all-queued board column spends zero prefix width, and cell-width checks on the composed prefix. PTY QA at 150x40 on a project configured with To Do / Ready / In Progress / Waiting / Done and a 100-criterion task. bunx tsc --noEmit and bun run check . pass; bun run test is 2860 pass / 8 skip / 1 fail, matching a clean origin/main baseline run (2859 / 8 / 1) that fails the same ContentStore test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the TUI's ASCII acceptance-criteria bar with a single pie glyph plus the live checked/total count (○ ◔ ◑ ◕ ●, green/yellow/red unchanged), and moved column reservation into src/ui/task-row-prefix.ts, which sizes the status and progress columns per render from the rows actually on screen. Task ids line up on the board and in the task list, custom status labels are preserved, counts of any length fit, and a render pays only for columns something on it fills. The prefix is emitted before the row-level move and cross-branch tags so those colors survive the whole row. Verified with 13 unit tests covering the glyph thresholds, the color at each threshold, id alignment across custom statuses / three-digit counts / rows without progress, zero prefix width for an all-queued board column, and cell widths on the composed prefix; plus PTY renders at 150x40 with a five-status workflow and a 100-criterion task. Plain and MCP output untouched. bunx tsc --noEmit and bun run check . pass; bun run test is 2860/8/1, matching a clean origin/main baseline that fails the same ContentStore flake. PR #996.
<!-- SECTION:FINAL_SUMMARY:END -->
