---
id: BACK-222
title: Show nested tasks together on the Tasks page and in the task view
status: In Progress
assignee:
  - '@claude'
created_date: '2025-08-03'
updated_date: '2026-11-25T08:52:00Z'
labels:
  - web
dependencies:
  - BACK-829
references:
  - src/utils/task-subtasks.ts
  - src/web/App.tsx
  - src/web/components/TasksPage.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/TaskDetailsModal.tsx
modified_files:
  - src/utils/task-subtasks.ts
  - src/test/subtask-progress.test.ts
  - src/test/task-subtasks.test.ts
  - src/web/lib/task-nesting.ts
  - src/web/components/SubtaskControls.tsx
  - src/web/components/SubtaskTree.tsx
  - src/web/components/TasksPage.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/test/task-card-nesting.ts
  - src/test/web-task-project.test.tsx
  - src/test/web-task-types.test.tsx
  - src/test/web-task-details-modal-acceptance-criteria.test.tsx
  - src/test/web-task-card-dates.test.tsx
  - src/test/web-task-acceptance-progress.test.tsx
  - src/test/web-board-batch-move.test.tsx
  - src/test/web-board-drag-hidden-columns.test.tsx
  - src/test/web-task-column-sort.test.tsx
  - src/test/web-tasks-page.test.tsx
  - src/test/web-nested-tasks.test.tsx
  - src/test/web-task-details-modal-subtasks.test.tsx
  - src/test/web-task-details-modal-unsaved-navigation.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People who use Backlog.md have asked for a long time to see nested tasks together, and some nest tasks four or five levels deep. In the web UI today every subtask is its own row in the List and its own card on the Board, and nothing on a parent says that it has subtasks, so the work under a parent is scattered across the page. The hierarchy shows only inside the task dialog, as a link to the parent and a flat list of direct subtasks.

Direction from the maintainer on 2026-11-23, given while reviewing the web redesign drawings: tasks nested four or five levels deep must show together; each level opens and closes like an accordion, so deep nesting does not break the layout; and a task that has nested tasks must show that clearly while it is closed.

What the approved drawings show:

- Every task with subtasks carries a marker with the number of finished and total direct subtasks. The marker is also the control that opens them in place.
- In the List, opened subtasks sit under their parent as a tree with one guide line per level, and the columns on the right stay aligned at every depth.
- On the Board, a parent card ends in a bar with the subtask count. Opening it lists the subtasks inside the card, level by level. A subtask keeps its own card in the column of its status, with a link to its parent.
- The task view has a Subtasks section with the same tree and the same markers.

Context:

- BACK-829 made the Kanban board and All Tasks one Tasks page with a List and a Board layout. This task builds the hierarchy into both layouts and into the task dialog. BACK-830 then turns the task dialog into a page and keeps its sections, so the Subtasks tree carries over.
- Which tasks are subtasks of which, and how many of them are finished against the configured final status, already follow shared rules that the task dialog uses. BACK-549 asks for the same presentation in the TUI, so the web and the TUI must not disagree about either.

To settle with the maintainer at plan review:

- Where a subtask appears in the List when its status differs from its parent's: under its parent, in the group of its own status, or both.
- How the filters and the search treat a parent and its subtasks, for example a subtask that matches while its parent does not.

This task was written in August 2025 and rewritten on 2026-11-24 for the current web UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On the Tasks page, a task with subtasks shows a marker in its List row and on its Board card with the number of finished and total direct subtasks, where finished means the configured final status; a task without subtasks shows no marker.
- [x] #2 The marker opens and closes the task's direct subtasks in place, every level opens and closes on its own, and the open state can be reached and changed with the keyboard and is announced to assistive technology.
- [x] #3 In the List, opened subtasks show under their parent as a tree with one guide line per level, and the other columns stay aligned at every depth.
- [x] #4 On the Board, a parent card ends in a bar with its subtask count that opens the subtasks inside the card level by level, and each subtask keeps its own card in the column of its status with a link to its parent.
- [x] #5 The task dialog shows the task's parent and a Subtasks section with the same tree and markers; opening a parent or a subtask from it uses the task routes, and closing returns to where the person came from.
- [x] #6 Tasks nested five levels deep stay readable in the List, on the Board and in the task dialog, and deeper levels never push the other List columns or widen a card.
- [x] #7 Every task stays findable in both layouts whatever the status of its parent and whatever filters apply, and a subtask shown apart from its parent can be traced to it.
- [x] #8 Creating, editing, ordering, dragging and moving tasks work as before, and what parent and subtask mean does not change.
- [x] #9 The page is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone, for tasks without subtasks, with many subtasks and nested five levels deep.
- [x] #10 Tests cover the marker count against a configured final status, opening and closing levels, the List tree, the Board card, five levels of nesting and the task dialog's Subtasks section.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decided by the maintainer on 2026-11-25; nothing is open. Updated after implementation to match the final solution.

Decisions
- A. A subtask whose status differs from its parent's is listed in the group of its own status with a link to its parent, and under its parent when the parent is opened. A subtask with its parent's status is listed only under its parent.
- B. Filters and the search decide every row, inside trees too, as in the CLI. A subtask that matches while its parent does not is listed at the top of its group with a link to its parent. While filters or the search narrow the page, a parent with matching subtasks opens by itself, so a match never hides inside a closed parent. Markers still count every direct subtask, and an opened parent with no matching subtask says "No subtasks match these filters".
- C. A Board card becomes a container like a List row, with the title as its button (Enter opens, Ctrl/Cmd/Shift+Enter selects; mouse click and drag as today), so the bar, the subtask rows and the parent link can sit inside it.
- D. A marker stays open per place on screen for the page view: it survives filters, closing a group or lane, and opening a task. Nothing goes to the URL or browser storage.
- E. The new tree and the parent link in the task dialog ask before leaving unsaved edits, as links in the dialog already do (reproduced: an unsaved description was lost when a subtask was clicked).
- F. Left out: Add subtask, the Blocked chip and Show all. Accepted deviations from the drawing: the marker's name has no "Show it" or "Hide them" (aria-expanded announces the state), trees list subtasks in task ID order, and rails are 14px everywhere. The em dash in the dialog title predates this task and stays for BACK-830.

Flows this extends: the /tasks List (TaskList), the /board Board (Board, TaskColumn, TaskCard), the task routes /tasks/:id and /board/:id that open the task dialog (TaskDetailsModal: its parent link and Subtasks section), and App's one open flow, handleOpenTask, for every link to a task. App loads data as today: no new request, endpoint or route, and the same loaded tasks. Nothing new writes to tasks; drag, move, reorder and their no-op guards stay as they are.

1. Shared rules: src/utils/task-subtasks.ts (the web now, the TUI in BACK-549)
- createTaskHierarchy(tasks) reads once which task is the parent of which and answers subtasksOf(task) and parentOf(task). Subtasks are the direct ones, in task ID order (BACK-2.2 before BACK-2.10), as `backlog task view` lists them. IDs are compared in their canonical form (letter case and zero padding do not matter); a parent ID written without a prefix, as an old archived file can hold, takes the prefix of the subtask's own ID. The parent is parentTaskId; the dots of an ID decide nothing. One pass per task list, because scanning the list for every task took 870 ms for 2,000 tasks.
- summarizeSubtaskProgress(subtasks, statuses) counts the subtasks in the configured final status ({ total, completed }, null without subtasks).
- findTopLevelTasks(groupTasks, hierarchy) returns the tasks a status group lists at its top level, in the group's order: every task whose parent is not in the group. A task whose parent is in the group is listed under it, at any depth. Tasks are compared by canonical ID, so a group may hold copies. Tasks whose hand-edited parents form a loop cannot be reached from the top: the first of them is listed at the top level and the others under it, so no task disappears.
- No depth limit anywhere. The TUI board's buildColumnTasks (src/ui/board.ts, around line 116) adds only the children of top-level tasks, so a same-status grandchild is dropped and the column count drops with it (GitHub #1260). These rules walk every level, so BACK-549 can reuse them; the TUI is not changed here.
- findDirectSubtasks (delete guard) and attachSubtaskSummaries (CLI task view, TUI) read the same index; findParentTask is gone.

2. Web nesting: src/web/lib/task-nesting.ts
- TaskNesting { all, visible, isFiltered }: the hierarchy of every task (what markers count and parent links open), the hierarchy of the tasks the filters keep (what an opened level lists), and whether filters or the search narrow the page. TasksPage builds it from the tasks it holds and visibleTasks and passes it to TaskList and Board; the dialog uses createUnfilteredNesting(availableTasks).
- useSubtaskLevels() is the open state of one owner (TaskList, Board, the dialog): the levels a person opened or closed, recorded by path (the task IDs from the top-level row or card down to the level's task), and setOpen(path, open).
- readSubtaskLevel(task, path, nesting, levels, statuses) gives a row its marker count (null without subtasks) and whether its level is open: as recorded, or else open only while the page is filtered and the task has matching subtasks. A task already above its own level sits in a hand-edited loop and never opens by itself, so a filtered page cannot open levels without end.

3. Controls: src/web/components/SubtaskControls.tsx
- SubtaskMarker: a chip after a title with the subtask icon, "1/3" in mono and a chevron (right when closed, down when open); a button with aria-expanded and aria-controls, named "3 subtasks, 1 done" (or "none done"), with the same tooltip.
- SubtaskBar: the last line of a Board card with subtasks: icon, "3 subtasks", "1/3" and the chevron, with the same name and semantics.
- ParentTaskLink: the parent's ID with a chevron, a button named "Parent task BACK-2: <title>" that opens the parent; the ID as plain text when the parent is not on the page.
- SubtaskRails: one 14px guide line per level; the lines run the full row height, so they join from row to row.
- Each control stops its click, so the row or card around it neither opens nor selects.

4. List: TaskList.tsx
- Groups, their order and their counts stay as today (sectionTasks(sortTasks(visibleTasks)); a group counts every task of its status the filters keep, also those under a closed parent, as `backlog task list` counts them). Each group lists findTopLevelTasks.
- TaskRow shows one task and, while its level is open, a nested list (ul in li) of its subtasks the filters keep, one level deeper. The mouse click is on the row, not the li, so a click on a subtask row opens that subtask and not its parent.
- Top-level rows keep today's columns; a subtask row puts its rails, status, ID and title in the flexible middle column, so the criteria, assignee and time columns keep their place at every depth. Below 64rem a subtask row's title moves under its status and ID when less than 12rem is left, and a top-level subtask row's title moves under its parent link when less than 10rem is left.
- A subtask listed at the top of its group shows its ParentTaskLink before its title. IDs keep one width per list, measured over the top-level rows.

5. Board: Board.tsx, TaskColumn.tsx, TaskCard.tsx, SubtaskTree.tsx
- Columns, counts, order, lanes, drag and drop, selection, the column menu, cleanup and hide-empty-columns are unchanged: every task the filters keep has its own card in its status column.
- TaskCard: the card keeps drag, the mouse click (open; Ctrl/Cmd/Shift-click selects), its selection state and its look; the title is the button, named as the card was ("Open <ID>: <title>. Acceptance criteria progress: x of y"); Enter opens through the card's click, and Ctrl/Cmd/Shift+Enter selects. A subtask card shows its ParentTaskLink before its ID; in a narrow card the ID moves to a line of its own.
- A parent card ends in SubtaskBar; opened, SubtaskTree lists the subtasks the filters keep, level by level: rails, status, ID, title button and marker. Tree rows are not cards: they open their task and cannot be dragged or selected. When less than 7rem is left beside the ID, the title and its marker move under it, and IDs may wrap, so five levels never widen a card. Board holds the open state, so filters, lanes and opening a task keep it.

6. Task dialog: TaskDetailsModal.tsx
- The parent link keeps its place and look (BACK-830 restyles it). The Subtasks section shows "Subtasks" with "1/3" and SubtaskTree over every subtask, each row with status, ID, title, marker and the criteria ring. SubtaskTree uses the BACK-828 tokens, so BACK-830 moves it to the page unchanged.
- Rows and the parent link open their task through onNavigateToTask (handleOpenTask replaces the task route and keeps where the person came from). mayLeaveEdits asks "Discard unsaved changes and leave this task?" first while there are unsaved edits; links in the dialog ask through the same function. The flat list, its "N of M complete" text and the test-only data attributes are gone.

7. Keyboard and screen readers: markers, bars and parent links are native buttons in reading order; Enter or Space opens and closes, focus stays, aria-expanded announces the state, and an opened list follows in Tab order (disclosure pattern, like the group headers). Subtasks are nested lists, so screen readers announce the level; rails are decorative. Closing a task returns focus to the row that opened it.

8. Unchanged: which tasks load; the filter URL and applyTaskFilters; group order and counts; the board's columns, lanes, drag, selection, column menu, cleanup and hide-empty-columns; creating and editing tasks and every write and no-op guard; what parentTaskId means; CLI, TUI and MCP output.

9. Tests (files that use jsdom run in the serial DOM pass)
- task-subtasks.test.ts (renamed from subtask-progress.test.ts): direct subtasks in ID order; padding and letter case; a parent ID without a prefix; the #1260 trio and a five-level chain reach every task (also with copied tasks); a loop of parents keeps every task.
- web-nested-tasks.test.tsx: List and Board for #1260; the marker against a custom final status; levels opening on their own; five levels with details; decision A placement and parent links; decision B (a subtask-only match, parents opening by themselves, a Status filter narrowing a tree, the empty level text); a loop under a search rendered once around; clicks on subtask rows, bars and parent links never opening or selecting the card.
- web-task-details-modal-subtasks.test.tsx (rewritten): the tree, its markers and counts, deeper levels, opening a subtask and the parent. web-task-details-modal-unsaved-navigation.test.tsx: the tree and the parent link ask first. web-task-detail-deeplink.test.tsx: open a parent from the filtered List, a subtask from its tree, close back to the List with the query and focus.
- Adjusted for the new props and the card's title button: web-task-card-dates, web-task-acceptance-progress, web-board-batch-move, web-board-drag-hidden-columns, web-task-column-sort, web-tasks-page, web-task-project, web-task-types, web-task-details-modal-acceptance-criteria, with the shared helper task-card-nesting.ts.

10. Verification (criterion 9): type check, Biome, focused and full test suites as CI runs them, bun run build and the smoke script; the compiled binary on a temporary project with every nesting case and on 2,000 tasks; headless Chrome in light and dark at 1440, 1280, 768 and 390 px with measured column positions and card widths; a keyboard-only pass; the accessibility tree; the static export; typing speed against origin/main; a contrast table; codehygiene, a cold simplicity review and a final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (maintainer, 2026-11-25): A both places (a different-status subtask in its own group with a parent link, and under its opened parent); B filters decide every row, inside trees too, a subtask-only match sits at the top of its group with a parent link, parents with matching subtasks open by themselves while the page is filtered, markers count every direct subtask, and an opened parent without matches says "No subtasks match these filters". Rulings (coordinator, same day): C the Board card is a container with its title as the button; D open state per place on screen for the page view, nothing in the URL or storage; E the tree and the parent link ask before leaving unsaved edits; F no Add subtask, Blocked chip or Show all, no "Show it/Hide them" in the marker name, trees in ID order; the dialog title's em dash stays for BACK-830.

Built differently from the first plan, and why
- The hierarchies are built where the task lists are, not in App: TasksPage from its tasks and from visibleTasks, the dialog from availableTasks. One build in App would have needed a second prop beside every task list and a hierarchy argument in 16 dialog tests, with nothing to stop the two from being built from different lists.
- Parent IDs: canonical IDs, and a parent ID without a prefix takes the subtask's own prefix. Archived files keep the IDs they were written with, so `parent_task_id: 5` in an archived BACK-5.1 still names BACK-5 for the delete guard (found by the cold review; test "matches a parent ID written without its prefix by the subtask's own prefix").
- Rails are 14px in the List too, one width everywhere (the drawing had 18px in the List).
- Narrow widths: a subtask row's title moves under its status and ID below 12rem, a top-level subtask row's title moves under its parent link below 10rem, a card header puts a long ID on its own line, and a tree row's title and marker move under the ID below 7rem. Found in the 390 px screenshots, where a parent link squeezed the ID to one character per line and a level-five tree row overflowed its card by 14px.
- The open state is one hook, useSubtaskLevels, and readSubtaskLevel reads a row's count and open state, instead of the same lines in four places (cold review).

Cold simplicity review (fresh agent, task, diff and repository only)
- Blocking, reproduced and fixed: with a hand-edited loop of parents, a search kept opening levels by itself without end (the page never finished rendering, 6 to 7 GB in 15 s). readSubtaskLevel no longer opens a level by itself when its task is already above it. Test "opens a hand-edited loop of parents only once around while a search keeps it" renders to a string, so a regression fails at once (it failed in 300 ms with a stack overflow without the guard).
- Applied: the prefix-less parent ID above; findTopLevelTasks compares canonical IDs instead of objects; TaskNesting.shown renamed visible; one open-state hook and one count and open reader; setOpen(path, open) instead of a toggle that took the current state; the tree's title button opens its task itself; SubtaskRails moved to the shared controls; one wording for "No subtasks match these filters" and the subtask plural; one mayLeaveEdits question; the inert onClickCapture on the parent nav and the dead hover transform of HierarchyChevron removed; comments corrected (loops, the standalone card, the card's rows). "depth" in the compact tree is now "rails".
- Not changed: Firefox may not start a drag from a button inside a draggable card, so a drag that begins on a card title could fail there; not checked, Chrome only.

Final complexity review (full context): nothing blocking. Applied: the card destructures its level reading; the row padding and the rails' negative margins are named together (ROW_PADDING, RAILS_CELL); the level record is named recorded; tests find a group through its header's aria-controls.

codehygiene: the new files are clean; in the changed components it flags only JSX nesting (TasksPage, TaskCard), left as it is.

Measurements (compiled binary, headless Chrome)
- Columns: at 1440 px (one-line rows) the criteria, assignee and time columns sit at x 1139, 1215 and 1411 for every row at depths 0 to 5, light and dark. Below 64rem rows are two lines by design; no row is wider than the list at 1280, 768 or 390.
- Cards: with every level open, 48 cards at 1440, 1280, 768 and 390 px in both themes: no card wider than its column, none scrolls, no tree row past its card, five levels inside BACK-3's card.
- Typing on 2,000 tasks (500 nested five deep, a search keeping 367): 167 ms per key against 83 ms on origin/main (script 108 against 63, style 19 against 5, layout 13 against 3), because the page shows 313 rows and 10,947 nodes against 241 and 6,856: parents open by themselves (B) and subtasks show in both places (A). No key lost at 40 ms per key in the List or on the Board. The same 2,000 tasks without nesting: 87 ms against 83. The largest single cost in both builds is a date formatter that builds an Intl.DateTimeFormat for every date it renders (src/web, existing); caching the resolved time zone would help both, left as a possible follow-up.

Evidence by criterion
- AC1: a parent shows "1/3"-style markers in its List row and the SubtaskBar on its card, counted against the configured final status; no marker without subtasks. Tests: "counts finished subtasks against the configured final status, and marks only tasks with subtasks" (custom statuses Backlog, Doing, Shipped; a subtask in "Done" is not finished) and the Board bar test ("4 subtasks, 1 done"). Browser: markers in every screenshot, none on BACK-1.
- AC2: each marker and bar is a native button with aria-expanded and aria-controls; every level opens on its own and reopening a level brings back the levels below. Tests: "opens each level on its own and brings back the levels below when a level opens again". Keyboard pass (light and dark, compiled binary): Tab reaches each marker after its title with the 2px teal ring, Enter and Space toggle it, focus stays, the opened rows follow in Tab order. Accessibility tree: buttons named "1 subtask, none done" with expanded false and true, nested list items at levels 2 and 3.
- AC3: opened subtasks show under their parent as nested lists with one 14px rail per level, and the right-hand columns keep the same x at depths 0 to 5 (measured above). Tests: "reaches a subtask five levels down, and every level keeps its details" (six nested lists, the deepest row keeps its assignee).
- AC4: a parent card ends in the bar, which opens its subtasks level by level inside the card; every subtask keeps its own card with a parent link. Tests: the three Board tests in web-nested-tasks (including #1260: three cards, column count 3, TASK-1's bar opens TASK-1.1 and then TASK-1.1.1). Screenshots board-open.* at four widths in both themes.
- AC5: the dialog shows the parent link and the Subtasks tree with markers; rows and the parent link open their task through the task routes; closing returns to the filtered List with focus on the row. Tests: web-task-details-modal-subtasks (5), "opens a subtask from its parent's Subtasks tree and closes back to the filtered list" (deep link), and the two unsaved-edit tests. Keyboard pass: a tree row opens /tasks/BACK-3.1.1, Escape returns to /tasks with focus on BACK-3's title.
- AC6: five levels in the List, on the Board and in the dialog at 1440, 1280, 768 and 390 px in both themes, with the measurements above (no pushed columns, no widened or overflowing card). Screenshots list-open.*, board-open.*, dialog-root.*, dialog-deepest.*.
- AC7: every task stays reachable: the #1260 trio counts 3 and opens to all three (List and Board, tests and screenshots); a subtask-only search lists BACK-3.1.1.1.1.1 at the top of its group with "Parent task BACK-3.1.1.1.1" (test and list-subtask-only.*); a different-status subtask sits in its own group with its parent link and under its opened parent (test and list-other-status.*); a loop of parents shows every task; the read-only static export opens markers in both layouts.
- AC8: the board's existing tests pass unchanged in scenario (batch move, drag and hidden columns, column sort, lanes, cleanup); clicks on the bar, the tree rows and the parent link never open or select a card (test); keyboard: Ctrl+Enter selects a card, Escape clears, Space on a card title opens the task once; in headless Chrome a mouse drag starts both from a card's title button and from its footer, carrying the task's ID, status and lane (Input.dragIntercepted). parentTaskId keeps its meaning; CLI task view and delete tests pass.
- AC9: the compiled binary (bun run build, 1.57.4) served a temporary project outside the repository: a task without subtasks, a parent with 25 subtasks, a root nested five levels deep with siblings, the #1260 trio, subtasks in other statuses, a parent in the final status with an open subtask, a milestone, a subtask on another branch, a long title; plus 2,000 tasks. 64 screenshots: List, Board and dialog in light and dark at 1440, 1280, 768 and 390 px, a filtered view where only a subtask matches, the #1260 trio under a search, a Status filter. Keyboard-only pass in light and dark. The static export.
- AC10: task-subtasks.test.ts (8), web-nested-tasks.test.tsx (14), web-task-details-modal-subtasks.test.tsx (5), two unsaved-edit tests and one deep-link test, as listed in the plan.

Contrast (WCAG 2, new pairs, both themes; text 4.5:1)
| Pair (foreground on background) | Light | Dark | Needed |
| --- | --- | --- | --- |
| Marker count and chevron, closed (ink-2) | 6.75 on surface | 8.92 on surface | 4.5 |
| Marker count and chevron, open (ink-2) | 5.94 on surface-2 | 8.01 on surface-2 | 4.5 |
| Marker on hover (ink) | 13.51 on surface, 11.90 on surface-2 | 14.84 on surface, 13.33 on surface-2 | 4.5 |
| Card bar text and count, closed (ink-2) | 6.75 on surface | 8.92 on surface | 4.5 |
| Card bar, open or hovered (ink) | 11.90 on surface-2, 11.59 on hover | 13.33 on surface-2, 12.07 on hover | 4.5 |
| Parent link (ink-3) | 5.77 on surface, 4.95 on hover | 5.97 on surface, 4.85 on hover | 4.5 |
| Parent link on hover (ink) | 13.51 on surface, 11.59 on hover | 14.84 on surface, 12.07 on hover | 4.5 |
| Tree row ID (ink-3) | 5.77 on surface, 4.95 on hover, 5.77 on the dialog card | 5.97 on surface, 4.85 on hover, 4.97 on the dialog card | 4.5 |
| Tree row title (ink) | 13.51 on surface, 11.59 on hover, 13.51 on the dialog card | 14.84 on surface, 12.07 on hover, 12.37 on the dialog card | 4.5 |
| No subtasks match these filters (ink-3) | 5.77 on surface | 5.97 on surface | 4.5 |
| Dialog Subtasks count (gray-500, the dialog's header style) | 4.84 on the dialog card | 5.64 on the dialog card | 4.5 |
| Rails (line, decorative: indentation and nested lists carry the depth) | 1.36 on surface, 1.17 on hover | 1.46 on surface, 1.19 on hover | none |

Checks on the final code: bun run check:types and bun run check pass; the web and changed unit tests pass (449); the full suite through scripts/run-ci-tests.ts with the CI flags (--profile=full --parallel=2 --isolate --timeout=10000 --max-concurrency=2) and the bundled test CLI passes: 3150 tests and 13 skipped in the parallel pass, 425 in the DOM pass; bun run build and scripts/smoke-compiled-build.ts dist/backlog 1.57.4 pass. Every screenshot, measurement and keyboard step above was repeated on the final binary.

Not verified: Firefox (which may not start a drag from a button inside a draggable card), Safari, Windows and Linux; a drop with a physical mouse (the existing drag tests cover drops); what a screen reader speaks (names, states and list levels were read from Chrome's accessibility tree); touch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Nested tasks show together on the Tasks page and in the task dialog. A task with subtasks carries a marker with the number of finished and total direct subtasks, counted against the configured final status; the marker opens and closes its subtasks in place, every level on its own, as a disclosure button that announces its state. In the List, opened subtasks sit under their parent as nested lists with one guide line per level, and the right-hand columns keep their place at every depth. On the Board, a parent card ends in a bar that opens its subtasks inside the card level by level, and every subtask keeps its own card with a link to its parent; the card is now a container whose title is its button, so these controls can sit inside it. The dialog's flat subtask list became the same tree, and its rows and parent link ask before leaving unsaved edits.

Decisions applied: a subtask in another status than its parent's is listed in its own group with a parent link and under its opened parent; filters and search decide every row, also inside trees, and while they narrow the page a parent with matching subtasks opens by itself. The rules live in src/utils/task-subtasks.ts (createTaskHierarchy, findTopLevelTasks, summarizeSubtaskProgress) with no depth limit, so BACK-549 can reuse them to fix GitHub #1260 in the TUI; the web reads them through src/web/lib/task-nesting.ts.

Verified with the type check, Biome, the full suite as CI runs it, the compiled binary and its smoke script, and headless Chrome on the compiled binary: List, Board and dialog in light and dark at 1440, 1280, 768 and 390 px with measured column positions and card widths at depth five, a keyboard-only pass, the accessibility tree, the static export and a contrast table.

Limits: on 2,000 tasks with 500 nested, a broad search costs 167 ms per key against 83 ms on main, because the page shows more rows (no keys lost; without nesting it is 87 against 83). Not checked in Firefox, Safari or with a screen reader.
<!-- SECTION:FINAL_SUMMARY:END -->
