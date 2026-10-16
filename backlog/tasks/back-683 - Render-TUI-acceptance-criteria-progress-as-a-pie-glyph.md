---
id: BACK-683
title: Render TUI acceptance-criteria progress as a pie glyph
status: Done
assignee:
  - '@codex'
created_date: '2026-09-02 21:40'
updated_date: '2026-10-16 07:27'
labels: []
dependencies: []
references:
  - src/ui/acceptance-criteria-progress.ts
  - src/ui/task-row-prefix.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
modified_files:
  - src/ui/acceptance-criteria-progress.ts
  - src/ui/task-row-prefix.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/tui-acceptance-criteria-progress.test.ts
  - src/test/tui-task-project.test.ts
  - src/test/tui-priority-marker.test.ts
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
- [x] #1 bun run check . passes when formatting/linting touched
- [x] #2 bun test (or scoped test) passes
- [x] #3 bun run check:types passes when TypeScript touched
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Integrate current origin/main into existing PR head e656730 without rewriting its ancestry; preserve the current priority marker, task sections, filtering, archive behavior and visible status labels.
2. Keep one shared measured row prefix for status and pie progress. Repair only bounded integration issues needed by the five accepted criteria.
3. Verify glyph thresholds/colors, mixed-row ID alignment, custom labels, counts above 100 and row highlighting with focused tests and compiled real PTY output. Confirm plain/MCP progress behavior stays unchanged.
4. Run bun run check:types, bun run check . and bun run build; perform a task-scoped simplification pass.
5. Stop with the integrated uncommitted result for the coordinator full-context review. Finalize the CLI task record, commit and push only after approval.
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

2026-10-16 merge preparation: reassigned to @codex. Earlier completion evidence remains historical; the current integrated result requires fresh checks and full-context review before finalization. Main-side task changes added only an updated date and the acceptance-criteria-progress source reference; preserved the reference through CLI.

Integrated current main. Kept archive/read-only flow, sorted and sectioned list rows, filter refresh, and priority markers. Adapted the priority-marker test calls to the simplified row formatter signature; extended existing alignment checks to cover wide custom labels and three-digit board counts.

2026-10-16 current-main verification: 34 focused tests across progress/project/priority/width/tag files pass, plus 109 separate related flow/plain/MCP tests across seven files. The compiled task-list order PTY suite has four distinct scenarios: three pass under restriction; the watcher-order scenario could not launch its Tcl exec edit because Tcl reported "could not create error file for command: not owner". Unchanged main reproduced the same scenario failure. One justified rerun of only that scenario with needed access passed. No ordering, timing, fixture, or CI behavior was changed. Counts total 147 distinct passing scenarios across 13 files; the repeated 13 progress tests and scoped PTY rerun are not additional tests.

Compiled custom PTY QA: five captured terminal frames at 151x40 with To Do / Ready / In Progress / Waiting / Done, 12 tasks, empty criteria rows, and counts up to 120/120. Replayed real ANSI output with the existing xterm headless dependency: all list IDs occupy cell 26; active board IDs occupy cell 72; ○ ◔ ◑ ◕ ● are one cell; unselected progress colors are red/yellow/green; custom labels, current priority arrows, selection inverse style and move-row highlighting remain visible. Current column widths still truncate long titles. UTF-8 and font support match the existing status glyphs. Plain/MCP criteria suffix tests pass; their shared formatter body is unchanged.

Simplification pass: kept the single measured prefix shared by board and task list, dropped the old wide/compact ASCII constants and unused width plumbing, and added no parallel formatter, cache, service or compatibility API. The current-main list computes widths after its final sorted/limited/sectioned rows on initialization and filter refresh. bun run check:types passes (565 files); bun run check . passes (460 files); bun run build and git diff --check pass. The result remains detached and uncommitted for full-context review; original PR completion fields will be refreshed only after review approval.

Finalization evidence for AC 1-4: 13 progress tests prove the five glyph thresholds, colors, one-cell widths and mixed-row alignment, including custom wide labels and three-digit counts. Compiled PTY captures verify the actual board/list output with 120 criteria and row selection/move styles. AC 5: unchanged summary suffix body and passing cli-task-list/mcp-tasks criteria tests prove plain/MCP output. All three current DoD checks passed. Full-context review returned KEEP for all seven frozen source/test hashes. Corrected the stale type-check DoD to the current canonical bun run check:types command. Historical notes above describe earlier implementation stages and checks; this final summary records the integrated result. For precision, the exact restricted Tcl error was: couldn’t create error file for command: not owner.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In Progress rows with criteria now show one pie glyph and the live checked/total count on the TUI board and task list. One shared measured prefix aligns task IDs across mixed rows, custom status labels and three-digit counts. Status words remain visible; progress colors, move highlighting, cross-branch dimming, current task ordering and priority markers are preserved. Plain and MCP list output is unchanged.

Verification: 147 distinct passing scenarios across 13 files, including four compiled task-list PTY scenarios. The restricted watcher-order run could not start its Tcl edit; unchanged main reproduced that environment failure, and one scoped rerun with the needed access passed. Five custom compiled PTY frames cover 12 tasks, five statuses and 120 criteria, confirming ID alignment, single-cell glyphs, colors and highlighting. bun run check:types, bun run check ., bun run build and git diff --check pass. The simplification pass kept one prefix implementation and removed obsolete width modes. Full-context review approved the exact source and test hashes. Long titles still truncate at existing column widths; Unicode support matches the existing status icons. PR #996.
<!-- SECTION:FINAL_SUMMARY:END -->
