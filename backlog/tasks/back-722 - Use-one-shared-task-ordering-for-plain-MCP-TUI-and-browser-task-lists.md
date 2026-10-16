---
id: BACK-722
title: 'Use one shared task ordering for plain, MCP, TUI, and browser task lists'
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:42'
updated_date: '2026-10-11 19:03'
labels:
  - enhancement
dependencies:
  - BACK-721
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1071'
  - src/utils/task-sorting.ts
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/unified-view.ts
  - src/web/components/TaskList.tsx
  - src/ui/tui.ts
  - src/ui/board.ts
modified_files:
  - src/utils/task-sorting.ts
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/ui/priority-marker.ts
  - src/ui/tui.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/board.ts
  - src/ui/unified-view.ts
  - src/test/task-list-order-fixture.ts
  - src/web/components/TaskList.tsx
  - CLI-INSTRUCTIONS.md
  - src/test/tui-task-list-order-pty.test.ts
  - scripts/run-tui-interactive-tests.sh
  - src/test/task-list-order.test.ts
  - src/test/web-task-list-labels-menu.test.tsx
  - src/test/task-sorting.test.ts
  - src/test/subtask-ordering-consistency.test.ts
  - src/test/tui-priority-marker.test.ts
  - src/test/unified-view-filters.test.ts
type: enhancement
ordinal: 340000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The interactive `backlog task list` orders tasks with its own logic. A user who orders work with priority and `--ordinal` sees `backlog task list --plain --sort ordinal` print that order, while the interactive list groups by priority and then sorts by task ID, so the order set from the CLI and the order shown in the terminal UI disagree (issue #1071, 1.53.0). The maintainer confirmed that the TUI list has separate ordering logic and that list ordering belongs in one common handler used by every interface: plain, MCP, TUI, and browser.

Decided for this task: without a sort, every task list uses one default order, ordinal then priority then ID, which is the order MCP `task_list` already uses. The TUI task list groups its rows by status the way plain output does. TUI list rows show each task's priority as a 2-column arrow before the title, which the issue also asks for. The browser All Tasks table takes the three sorts it has in common with the CLI from the shared ordering and keeps its own default order and its other column sorts.

Depends on BACK-721, which corrects how plain output selects tasks after sorting; this task builds on that ordering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 For the same filters and sort options, the interactive `backlog task list` shows the tasks `backlog task list --plain` prints, in the same order, grouped by status the way plain output groups them (one flat list for `--sort priority`).
- [x] #2 One function decides task list order, including the order used when no sort is given, and one function builds the status sections. Plain, JSON, MCP `task_list` and the TUI task list call them, and no interface keeps a copy of its own.
- [x] #3 Without a sort, plain, JSON, MCP `task_list` and the TUI task list order tasks by ordinal, then priority, then ID. MCP output does not change; `backlog task list` without `--sort` changes in plain, JSON and the TUI.
- [x] #4 The order printed by `backlog task list --plain` and `--json` does not change for any `--sort` value.
- [x] #5 The TUI task list reached by Tab from the board, from a task view or from search shows the same rows in the same order as `backlog task list` without `--sort`. A list left open while tasks change on disk keeps its rows in sorted order and its selection on the same task.
- [x] #6 TUI task list rows show a 2-column arrow before the title for a task whose priority is in the configured priority list: a Unicode arrow, or an ASCII arrow on a terminal without Unicode. The arrow's direction comes from the priority's position in the configured order, up toward the top and down toward the bottom, for a list of any length.
- [x] #7 In the browser All Tasks table, sorting by ID ascending, by priority with the highest first and by ordinal ascending gives the order of `--sort id`, `--sort priority` and `--sort ordinal`. Its default order (newest first) and its other column sorts do not change.
- [x] #8 Help text, CLI-INSTRUCTIONS.md and shipped guides that state the default task list order describe the new default.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Final plan, on branch tasks/back-722-shared-task-ordering (stacked on BACK-721).

## Two shared functions

Both live in src/utils/task-sorting.ts.
- `sortTasks(tasks, sort, priorities)` decides the order of a task list. The named sorts (`priority`, `id`, `ordinal`) come from one table, which also provides the values `--sort` accepts, so a new sort value is added in that table only. An omitted sort gives the default order: ordinal, then priority, then ID.
- `sectionTasks(tasks, sort, statuses)` decides the layout: the sections an ordered list is shown in. An explicit `--sort priority` is flat, one section without a status. Every other order has one section per status, configured statuses first, other statuses after, each keeping the order of the list it was given. The status grouping moved here from src/cli.ts, and the flat check is private to this file.

## Surfaces

| Surface | Change | Visible result |
|---|---|---|
| Plain `task list --plain` | Calls `sortTasks` with the sort as given and prints the sections of `sectionTasks`; the local status grouping, the local flat check and the sort value list are deleted | Without `--sort`: ordinal, priority, ID inside each status (was priority, ID). Each `--sort` value: unchanged |
| JSON, `--json --watch` | Same `sortTasks` call | Without `--sort`: ordinal, priority, ID (was priority, ID). Shape and each `--sort` value: unchanged |
| MCP `task_list` | Sorts once with `sortTasks`, sections with `sectionTasks`; its inline copy of the grouping is deleted; the `limit` loop stays | None |
| TUI list from `backlog task list` | The list view computes its rows in one function (`listRows`) on the first render and on every refresh: filters, readiness, `sortTasks`, `--limit`, `sectionTasks`. The loader in src/cli.ts stops sorting | Rows are grouped by status in configured order, flat for `--sort priority`; default order is ordinal, priority, ID; rows move to their sorted place when tasks change on disk; the highlighted task stays highlighted |
| TUI list from the board (Tab), a task view, or search | Same row function, no sort given | Same rows and order as `backlog task list` without `--sort` (was ID order) |
| Browser All Tasks | ID ascending, Priority highest first and Ordinal ascending call `sortTasks` | Priority highest first breaks ties by ID ascending (was descending). Default order and other sorts unchanged |
| Boards, `draft list`, `search`, `board export`, browser Drafts and Milestones | Not changed. The TUI board still cuts `--limit` from the sorted list by calling `sortTasks` before the cut, and the interactive draft list hands its sort to the view | None |

## TUI patterns extended

- Row rendering: `formatTaskViewerListItem` in src/ui/task-viewer-with-search.ts, the existing one-line row (status icon and name, ID, badges, title, assignee, labels).
- Task details: `generateDetailContent`, which the detail pane and the board's task popup share. It keeps the priority name and draws the marker after it.
- Status sections: the sections of `sectionTasks`, which plain output prints under status headings. The TUI list shows the same sections as consecutive rows; each row already starts with its status icon and name, so no heading rows are added.
- Selection: the list already finds the highlighted task by ID after each refresh (`applyFilters`); that is kept. A list opened without a chosen task starts on its first row, as it did when the loader sorted.
- Key handling, footer hints and boundary navigation are not touched.

## Priority marker

One arrow from `formatPriorityMarker` in src/ui/priority-marker.ts, the only priority glyph in the TUI. The colored dot (`getPriorityDisplay`), which existed only for priorities named high, medium and low, is deleted.
- On a task list row the arrow stands where a row without a marker has the dash between ID and title (`TASK-3 ↑ Charlie`, `TASK-5 - Echo`): two columns with its space, directly before the title, and no wider than before, so it cannot push the ID or the title out of an 80-column terminal. An earlier version that kept the dash dropped the title of an In Progress row at 80 columns.
- In task details (the detail pane and the board's task popup) it follows the priority name: `Priority: Now ↑`.

Mapping, for N configured priorities and position i from the top (0-based): an up arrow when i is above the middle of the list (i < (N-1)/2), a down arrow when it is below, and a right arrow for the middle entry of an odd-length list. Examples: now, next, later and high, medium, low give up, right, down; two priorities give up, down; four give up, up, down, down; five give up, up, right, down, down. A higher priority never shows an arrow that points lower than a lower priority's arrow. Up is red, right is yellow, down is green, the colors the dot used; the direction alone carries the meaning without color.

Glyphs: `↑`, `→`, `↓`, which the footer hints already draw. On a terminal without Unicode the terminal library replaces a glyph with its entry in its own ASCII table, or with `?` when it has none, which is what happened to these arrows. src/ui/tui.ts adds `^`, `>`, `v` and `<` for the four arrows to that table when it creates a screen, so markers and the arrow hints of every screen fall back to ASCII arrows through the detection the library already does.

## Steps

1. src/utils/task-sorting.ts: sort table, default order, `sectionTasks`.
2. src/cli.ts: use them for plain and JSON; delete the local grouping, flat check and sort list; the interactive loader passes the sort to the view instead of sorting; `--sort` help states the default order.
3. src/mcp/tools/tasks/handlers.ts: use them; delete the inline grouping.
4. src/ui/task-viewer-with-search.ts, src/ui/unified-view.ts, src/ui/board.ts: rows from `listRows`, start on the first row when no task was chosen, board `--limit` cut after `sortTasks`. Delete `filterTasksForKanban`, which only tests called and which cut a limit without sorting.
5. src/ui/priority-marker.ts and src/ui/tui.ts: the marker and the ASCII arrows; the marker in rows and in task details; delete `getPriorityDisplay`.
6. src/web/components/TaskList.tsx: the three shared sorts.
7. CLI-INSTRUCTIONS.md: a "Task list order" section with the default order and the interactive list.
8. Tests on one fixture (src/test/task-list-order-fixture.ts: priorities now, next, later; status, priority, ordinal and ID orders all different): literal `--plain` output and `--json` IDs without `--sort` and per `--sort` value, and MCP `task_list` through the in-process server (task-list-order.test.ts); the interactive list through the `expect` PTY harness (tui-task-list-order-pty.test.ts: rows per option compared with `--plain`, Tab from the board, a task view, search, a change on disk while open with the selection kept, the marker in Unicode and ASCII); All Tasks through the TaskList component tests. The arrow mapping, the marker in task details and the shared helpers have unit tests. In unified-view-filters.test.ts the assertions that went through `filterTasksForKanban` call `applyTaskFilters` with the shared filter values, and the two tests of its limit are removed.
9. Verify: scoped tests, `bunx tsc --noEmit`, `bun run check .`, terminal captures at 80 and 120 columns with custom priorities in Unicode and ASCII, All Tasks in a browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-722-shared-task-ordering, stacked on BACK-721 (pull request #1087).

What changed
- src/utils/task-sorting.ts: `sortTasks` takes an optional sort and owns the default order (ordinal, priority, ID). The named sorts live in one table that also exports `TASK_SORT_FIELDS`. `sectionTasks` owns the layout: status sections, or one flat section for an explicit priority sort. The status grouping moved here from src/cli.ts. `sortByOrdinalAndPriority` is no longer exported.
- src/cli.ts: plain and JSON pass `--sort` through to `sortTasks`, and plain prints the sections of `sectionTasks`. Deleted: the local `groupTasksByStatus`, the local flat check, the local sort value list, the `"priority"` default, and the sort in the interactive loader, including its second validation of the sort value. The `--sort` help states the default order. The interactive draft list hands its sort to the view so its order stays as it was.
- src/mcp/tools/tasks/handlers.ts: `task_list` sorts once with `sortTasks` and sections with `sectionTasks`. Deleted: its inline copy of the status grouping and the per-section sort. The `limit` loop is unchanged.
- src/ui/task-viewer-with-search.ts: `listRows` computes the rows (filters, readiness, `sortTasks`, limit, `sectionTasks`) and the list starts from them; `applyFilters` replaces them on every refresh and keeps the selection by task ID as before. New options `sort` and `startOnFirstRow`. The row draws the priority marker in place of the dash before the title, and task details draw it after the priority name. Deleted: `getPriorityDisplay` and the unsorted first copy of the rows.
- src/ui/unified-view.ts: passes the sort to the list and the board, and asks the list to start on its first row when no task was chosen. Deleted: `filterTasksForKanban`, which only tests called. src/ui/board.ts: a `--limit` cut is taken after `sortTasks`, so the board keeps showing the tasks the list shows for that limit, and the task popup gets the configured priorities.
- src/ui/priority-marker.ts (new): the arrow for a priority from its position in the configured list. src/ui/tui.ts: adds ASCII stand-ins for the four arrows to the terminal library's fallback table.
- src/web/components/TaskList.tsx: ID ascending, Priority highest first and Ordinal ascending return `sortTasks`; the ascending branch of the local ID comparison is deleted.
- CLI-INSTRUCTIONS.md: new "Task list order" section. No other shipped guide states a default order.
- scripts/run-tui-interactive-tests.sh: runs the new PTY test file.

Verification
- Fixture (src/test/task-list-order-fixture.ts), compared with the BACK-721 tree: `task list --plain` To Do section 3, 6, 1, 5 became 3, 1, 6, 5; `--json` 2, 3, 4, 6, 1, 5 became 2, 4, 3, 1, 6, 5, with the same envelope and task objects. For `--sort priority`, `id` and `ordinal`, 24 plain and JSON variants (uncut, `--limit`, `--max-count`, `--skip`) are byte-identical. MCP `task_list` is byte-identical for five argument sets, with and without `limit`.
- Run against the BACK-721 CLI, the default order test in task-list-order.test.ts fails and the three `--sort` tests pass.
- TUI in a real pseudo-terminal (tmux) on the fixture at 120 and 80 columns: rows 3, 1, 6, 5 (To Do), 2 (In Progress), 4 (Done), matching `--plain`; markers `↑ → ↓` and, with LC_ALL=C, `^ > v`; the detail pane shows `Priority: Now ↑` (`Priority: Now ^`), and the board's task popup shows the same line. At 80 columns every row keeps its ID and title (`◒ In Progress TASK-2 ↑ Bravo`). From the board with Tab the list shows the same rows (was 1 to 6). A list left open while TASK-5 got ordinal 50, TASK-3 moved to In Progress and TASK-7 was created re-sorted to match `--plain` and kept TASK-1 selected. Lists of five, four and two priorities show up, up, right, down, down; up, up, down, down; up, down.
- Browser, All Tasks of the fixture served from this branch: default 6 to 1; ID ascending 1 to 6; Ordinal ascending 2, 4, 3, 1, 5, 6; Priority lowest first 5, 1, 6, 4, 3, 2; Priority highest first 2, 3, 4, 6, 1, 5.
- `bun test --timeout=10000` per file, 45 files, no failures: task-sorting 30, task-list-order 6, tui-priority-marker 5, unified-view-filters 18, unified-view-loading 8, mcp-tasks 39, cli-task-list 20, cli-task-list-ordinal-sort 2, cli-list-window 17, cli-pipe-output 2, cli-json-output 16, cli-plain-output 5, cli-json-watch 8, cli-parent-filter 8, cli-status-filtering 9, cli-exclude-status-filtering 5, cli-milestone-filter 7, cli-task-type 5, cli-task-project 6, cli-guidance 16, cli-auto-plain-non-tty 4, readiness-surface-agreement 5, subtask-ordering-consistency 4, task-search-parity 17, board-hide-empty-columns 14, board-loading 10, board-popup-sync 7, board-tui-move 20, board-ui 7, footer-content 8, task-viewer-boundary-navigation 13, tui-acceptance-criteria-progress 8, tui-definition-of-done 1, tui-documentation 1, tui-final-summary 2, tui-emoji-width 4, tui-startup-warning 1, tui-task-lifecycle 3, tui-task-project 4, tui-task-type 4, tui-vim-boundary-navigation 6, tui-window-title 10, web-task-acceptance-progress 11, web-task-list-labels-menu 19, web-task-list-table-width 4. In one early run mcp-tasks had a single failure in a `task_search` test; it passed in every later run.
- With RUN_INTERACTIVE_TUI_TESTS=1: tui-task-list-order-pty 4 pass, and the three existing PTY files 6 pass.
- `bunx tsc --noEmit` exits 0. `bun run check .` reports no issues.

Choices the rulings did not settle
- Arrow mapping: up above the middle of the configured list, down below it, right for the middle entry. Accepted in review.
- On a row the marker stands in place of the dash before the title instead of after it.
- The ASCII arrows apply to every screen: on a terminal without Unicode the arrow hints in the footers change from `?` to `^`, `v`, `<` and `>`.
- When another process removes the selected task, the selection moves to the task the unified view picks, which is the next one by ID and not the next row.
- origin/main gained one commit that adds two task files. The stack was not rebased because the bottom branch is pushed.

Last round: the list rows are initialised in the first render (`let filteredTasks = listRows()` directly above it) instead of near the top of the view, and the pane label starts from the number of loaded tasks, which is the row count until a filter or limit narrows the list. Two test titles in unified-view-filters.test.ts now say that the shared filters carry the field and the task filter honours it. Rerun: unified-view-filters 18 pass, tui-task-list-order-pty 4 pass with RUN_INTERACTIVE_TUI_TESTS=1, `bunx tsc --noEmit` exit 0, `bun run check .` clean; in a terminal the pane label read Tasks (6), Tasks (4) with a status filter, Tasks (2) with `--limit 2`, and Tasks (0) for a draft opened in a project without tasks.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-10-11 11:13
---
Facts for the unconfirmed request to show priority on TUI list rows (issue #1071). Not planned.

- TUI list row today (`formatTaskViewerListItem`): status icon and name, ID, type and project badges, due date, title, then a colored dot for priority, assignee, labels. The dot is drawn only for priorities named high (red), medium (yellow) or low (green). With configured priorities such as now, next, later the row shows nothing for priority. The dot comes after the title, so a cut row loses it first. TUI board rows show no priority.
- Plain row (`formatPlainTaskListRow`): the stored priority in upper case and brackets before the ID, for example `[NOW] TASK-1 - title`.
- Row space: the list pane is 40% of the terminal, so a row has floor(0.4 x columns) - 4 columns: 28 at 80 columns, 44 at 120, 60 at 160. A plain-style label costs its length plus 3: 6 for `[LOW] ` or `[NOW] `, 7 for `[HIGH] ` or `[NEXT] `, 8 for `[LATER] `, 9 for `[MEDIUM] `. A To Do row with an 8-character ID uses 19 columns before the title, which leaves 9 columns of title at 80 columns today and 0 to 3 with a label; 25 and 16 to 19 at 120 columns; 41 and 32 to 35 at 160 columns. An In Progress row uses 25 columns before the title, so at 80 columns a label leaves no title.
---

author: @claude
created: 2026-10-11 16:26
---
Settled since comment 1: rows show the priority as a 2-column arrow before the title, taken from the configured priority order. The plan and notes describe it.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task lists now take their order from one function and their layout from another, both in src/utils/task-sorting.ts: `sortTasks` orders a list, including the order used when no sort is given, and `sectionTasks` splits the ordered list into status sections, or one flat section for an explicit priority sort. Plain, JSON, MCP `task_list` and the TUI task list call them. The CLI-local status grouping and flat check, the MCP copy of the grouping, the sort in the interactive loader, the helper `filterTasksForKanban` and the name-based priority dot are deleted.

What users see
- Without `--sort`, `backlog task list` orders by ordinal, then priority, then ID in plain, JSON and the TUI. MCP `task_list` already did. Every explicit `--sort` value prints byte-identical plain and JSON output, and MCP output is byte-identical.
- The TUI task list shows the rows `--plain` prints, in the same order and status groups, however it is opened (task list, Tab from the board, a task view, search). An open list re-sorts when tasks change on disk and keeps the same task selected.
- TUI rows and task details show the priority as an arrow taken from the configured priority order: up above the middle of the list, down below it, right for the middle entry of an odd list. On a terminal without Unicode arrows are drawn as `^`, `>`, `v`, which also applies to the arrow hints in footers.
- In the browser All Tasks table, ID ascending, Priority highest first and Ordinal ascending give the CLI's order for the same sort; equal priorities now break ties by ID ascending. Its default order and other column sorts are unchanged.

Not changed: MCP `limit`, both boards' column order, `draft list`, `search`, `board export`, the browser Drafts and Milestones pages.

Verification: one fixture project (src/test/task-list-order-fixture.ts) drives literal `--plain` and `--json` tests for the default and each `--sort` value, MCP through the in-process server, the interactive list through the `expect` PTY harness (order per option, each route into the list, a change on disk with the selection kept, the marker in Unicode and ASCII) and the All Tasks component test. 45 scoped test files and the four gated PTY files pass, `bunx tsc --noEmit` and `bun run check .` pass, and the TUI and the All Tasks table were checked in a real terminal and browser.

Follow-ups and risks: the four-level and longer priority lists share arrows between neighbouring levels; pull request #996 changes the same row-rendering lines, so whichever merges second needs a rebase; when another process removes the selected task, the selection moves to the next task by ID.
<!-- SECTION:FINAL_SUMMARY:END -->
