---
id: BACK-829
title: Show tasks on one page with List and Board layouts
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-23T20:53:00Z'
updated_date: '2026-11-24T19:59:00Z'
labels:
  - web
dependencies:
  - BACK-828
references:
  - src/web/components/BoardPage.tsx
  - src/web/components/Board.tsx
  - src/web/components/TaskList.tsx
  - src/web/App.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/LabelFilterDropdown.tsx
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/utils/kanban-tasks.ts
modified_files:
  - src/web/lib/task-filters.ts
  - src/web/lib/task-view.ts
  - src/web/components/StatusMark.tsx
  - src/web/components/PriorityBars.tsx
  - src/web/components/TaskTags.tsx
  - src/web/components/LabelFilterDropdown.tsx
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/components/TaskFilterPanel.tsx
  - src/web/components/TaskToolbar.tsx
  - src/web/components/TaskBranch.tsx
  - src/web/components/CleanupButton.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/lib/lanes.ts
  - src/web/components/Board.tsx
  - src/web/components/BoardLoadingSkeleton.tsx
  - src/web/components/TasksPage.tsx
  - src/web/App.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/TaskTypeBadge.tsx
  - src/web/components/ProjectBadge.tsx
  - src/web/utils/kanban-tasks.ts
  - src/utils/task-sorting.ts
  - src/test/web-board-batch-move.test.tsx
  - src/test/web-board-drag-hidden-columns.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
  - src/test/web-task-column-sort.test.tsx
  - src/test/web-task-types.test.tsx
  - src/test/web-task-project.test.tsx
  - src/test/web-side-navigation-loading.test.tsx
  - src/test/web-task-acceptance-progress.test.tsx
  - src/test/web-task-list-labels-menu.test.tsx
  - src/test/web-task-list-table-width.test.tsx
  - src/test/web-tasks-page.test.tsx
  - src/test/web-board-filters.test.tsx
  - src/web/components/MilestonesPage.tsx
  - src/test/web-milestones-page-unassigned-filter.test.tsx
  - src/test/web-board-loading-skeleton.test.tsx
  - src/web/styles/source.css
  - src/web/components/Navigation.tsx
priority: medium
type: enhancement
ordinal: 425000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Kanban board and All Tasks are two pages over the same tasks. They have different filters (the board filters by assignee and type, All Tasks by status and milestone), neither has a text search, and All Tasks cuts titles short in a narrow column. A person who filters one page and switches to the other starts again.

The web redesign approved by the maintainer on 2026-11-23 replaces both with one Tasks page that has a List layout, a Board layout and one toolbar. This is the second slice of that redesign. It follows the slice that introduces the colors, type and page shell.

What the drawing shows for the list: tasks grouped by status under a header with the status mark, name and count; one row per task with priority, ID, status mark, title, labels and type, acceptance-criteria progress, assignee and the time since the last update; the group of the final status collapsed. Status is drawn as a ring that fills with the position of the status in the configured workflow (empty for the first status, a check for the last), and priority as three bars.

To confirm with the maintainer at plan review: the drawing lists the statuses between the first and the last above the first status, so work in progress is at the top, while the board keeps workflow order. Whether the list uses that order or the configured order is not decided.

Related: BACK-260 and BACK-599 depend on which tasks the task list loads. This task does not change which tasks are loaded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One Tasks page offers a List and a Board layout through a switch. The chosen layout is part of the URL, survives a reload, and existing /board and /tasks links, including links to a task, keep working.
- [x] #2 Both layouts share one toolbar with the filters either page has today (status, excluded status, assignee, labels, type, project, priority, milestone), Clear filters and New task. A filter stays applied when the layout changes and is restored from the URL.
- [x] #3 The toolbar has a text search that narrows the visible tasks through the shared task search.
- [x] #4 The list groups tasks by status under collapsible headers that show the status name and count, keeps the shared task ordering inside each group, and starts with the final status collapsed.
- [x] #5 A list row shows priority, ID, status, title, labels and type, acceptance-criteria progress, assignee, the branch for a task from another branch, and the time since the last update. The title uses the free width and is cut with an ellipsis only when it does not fit.
- [x] #6 Status is shown by a mark whose fill follows the position of the status in the configured workflow, and priority by three bars. Both have a text alternative for assistive technology and do not rely on color alone.
- [x] #7 The board keeps what it does today: one column per status in workflow order, drag and drop of one or several selected cards, milestone lanes, the column sort menu, cleanup on the final column and the hide-empty-columns setting.
- [x] #8 The sidebar has one Tasks entry in place of Kanban Board and All Tasks.
- [x] #9 The page is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone.
- [x] #10 Tests cover the layout switch and its URL state, filters shared between layouts, and the grouped list.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decided by the maintainer on 2026-11-24; nothing is left open.

Decisions
- List groups follow the configured workflow order through the shared sectionTasks(sortTasks(...)), exactly like `backlog task list --plain`, with one shared order inside each group. The list has no column sorting and no sort menu.
- The header row stays exactly as it is. The page shows its "Tasks" title below it, and the title, toolbar and content share the header row's left edge at every width: both use the panel-gutter utility in source.css (px-2, lg:px-5).
- A list row shows the due date when one is set. The milestone, ordinal and created columns of All Tasks are dropped.
- The time since the last update uses the existing compact date (StoredDate compact); no second date format.
- Status and Exclude status apply on the board too. Columns stay, and hide-empty-columns behaves as today.
- Type and project chips are quiet, as drawn; the colored type and project palettes go. The word "Project" stays for the attribute filter and chips.
- Board cards keep their dates and project.
- Left out: a Display menu, "+" per status, "Show all" and "Show older", the Blocked chip and nested subtasks (BACK-222).
- The sidebar's Tasks entry and the start page open the layout last used in this browser, Board until one is chosen.
- The final status group starts open when the Status filter selects the final status; Clear filters also clears the search; a status that is not configured gets a dashed ring; custom priority lists are scaled to three bars; switching lanes keeps the milestone filter.
- Filtering runs in the browser on the tasks it already holds, through the one URL parser and the shared applyTaskFilters in src/utils/task-search.ts (the code behind /api/search). Condition: if the browser ever stops holding every task (paging, a change to which tasks load, lazy loading of several projects), filtering moves to the server with the same core function, because filtering a partial set gives wrong answers.

Flows this extends: the /board route (BoardPage, Board, TaskColumn, TaskCard), the /tasks route (TaskList), the task routes /board/:id/:title and /tasks/:id/:title that open the task dialog over either page, and the two page links of the sidebar. App.tsx keeps loading data exactly as today: no API request, loaded corpus or route changes.

1. Structure (src/web)
- components/TasksPage.tsx (new, replaces BoardPage.tsx): the Tasks page and the owner of its state and data flow. It reads the filters from the URL, rewrites non-canonical values once config is loaded, filters the tasks once with the shared task search, and renders the title, TaskToolbar, TaskFilterPanel and the List or Board layout. It also owns the board lane mode, the legacy ?highlight=<id> link, the cleanup dialog and its toast (one for both layouts) and the load error with Retry.
- components/TaskToolbar.tsx (new): the List/Board switch (two links that keep the query string), the search field, Filter (shows how many filters are active and opens the panel, which starts closed), Clear filters (while anything narrows the tasks; it gives focus back to Filter), Milestone lanes (Board only, disabled with today's reason when no task has a milestone) and New task (write access only). It holds no filter state.
- components/TaskFilterPanel.tsx (new): the eight filters of the two pages: Status, Exclude status and Labels (LabelFilterDropdown), Assignee (with Unassigned), Type, Project (only when projects are configured), Priority and Milestone (with No milestone).
- lib/task-filters.ts (new): the one owner of the filter URL contract (section 2): the TaskPageFilters type, readTaskFilters, writeTaskFilters, isFiltered, countActiveFilters and toTaskFilterOptions, which maps the filters to TaskFilterOptions of src/utils/task-search.ts. No component parses filter parameters itself.
- lib/task-view.ts (new): how the page shows its tasks: the layout of a path (/tasks List, /board Board) and the board lane mode, both remembered in this browser. The new stored key backlog.tasks.layout sits next to the existing backlog.board.lane.
- components/TaskList.tsx (rewritten): the List layout only, status groups and rows (section 4).
- components/TaskBranch.tsx and CleanupButton.tsx (new): the branch of a task from another branch, and the cleanup button of the final status, each drawn the same way in both layouts.
- components/Board.tsx (kept): the Board layout. It receives tasks (all, for lanes and lookups) and visibleTasks (what the filters keep). It loses its heading, New Task button, lane switch, filter bar, filter state, load error panel and its own copy of the milestone alias map; lib/lanes.ts exports the one canonicalizer the board still needs for batch moves.
- components/TaskColumn.tsx and TaskCard.tsx (kept): moved onto the BACK-828 tokens; the column header gets the status mark, a mono count and the cleanup button of the final column; cards get priority bars and TaskTags and keep their dates.
- components/StatusMark.tsx, PriorityBars.tsx and TaskTags.tsx (new): the one way to draw status, priority and the type, project and label chips in rows, group headers, column headers and cards.
- LabelFilterDropdown.tsx, AcceptanceCriteriaProgress.tsx and BoardLoadingSkeleton.tsx (kept): tokens; the dropdown and the column menu close with Escape and give focus back to their button; the skeleton loses its message chip, which no caller could reach.
- Removed: BoardPage.tsx, TaskTypeBadge.tsx, ProjectBadge.tsx and utils/kanban-tasks.ts (App filters archived records inline for the page); the All Tasks table, its column sorts and its server-side filter request.
- App.tsx: the board routes render TasksPage with layout "board", the tasks routes with layout "list", one shared prop set; both layouts get the same tasks, the loaded tasks without archived records. Routes and task-route handling stay; the start page opens the remembered layout.
- SideNavigation.tsx: one Tasks entry (section 6). MilestonesPage.tsx: its Board link names /board, because the start page now opens the remembered layout. src/utils/task-sorting.ts: only its comment about the browser list changes.

2. URL contract
- Paths are unchanged and carry the layout: /tasks is List, /board is Board, /tasks/:id[/:title] and /board/:id[/:title] open the task dialog over that layout, and invalid /tasks/* and /board/* links keep their message. Every existing /tasks and /board link (task links, bookmarks, the Milestones page links) keeps working without a redirect, and a reload restores the layout. Links to the start page, such as the legacy /?highlight=<id>, open the remembered layout.
- Query parameters, the same on both paths and written only when set: search, status (repeatable), excludeStatus (repeatable), assignee (__unassigned__ for Unassigned), label (repeatable), type, project, priority, milestone (__none for No milestone). Still read: every labels and excludeStatuses value, each split on commas. Board only: lane=milestone.
- Once config is loaded, the page rewrites the query (replace) to its canonical form: configured spelling for status, type, project and priority; unsupported type, project and priority values removed; legacy forms rewritten. It writes only when the canonical query differs.
- The switch keeps the whole query string and pushes history. Clear filters removes the filter and search keys and keeps lane and unknown keys.

3. Shared filters
- The URL is the only filter state. The Assignee filter matches a name in any letter case, as the CLI does, so its options list each name once. TasksPage computes visibleTasks = applyTaskFilters(tasks, toTaskFilterOptions(filters, milestoneResolver), searchIndex), with createTaskSearchIndex(tasks) built while a search is typed and the resolver from createMilestoneFilterValueResolver over active and archived milestones. The search and the eight filters mean on both layouts what they mean in `backlog task list`, the TUI and MCP. This replaces the board's own filter chain and the list's server request.
- Both layouts render visibleTasks. Milestone is an ordinary filter: in milestone lanes the board shows the lanes that keep tasks, and switching lanes keeps the filter.

4. List
- Groups: sectionTasks(sortTasks(visibleTasks, undefined, priorities), undefined, statuses). Each header is a button (aria-expanded) with chevron, status mark, name and mono count; the final status group carries the cleanup button. The final status group starts collapsed, or open when the Status filter selects it; collapse state is local.
- Row: priority bars, ID (mono), status mark, title, then the branch of a task from another branch, the due date, type, project and labels (at most three and "+N"), the acceptance-criteria ring, the first assignee (mono, "+N") and the compact time since the last update (updatedDate, else createdDate). The title takes the free width and is cut with an ellipsis only when it does not fit; its full text is in its tooltip. IDs keep one width per list, measured in the mono face. When the list is narrow, the details wrap to a second line.
- The title is a button named "Open <ID>: <title>" and the row is clickable; both use App's existing open flow.
- Empty states: "No tasks match these filters" or "No tasks yet".

5. Marks
- StatusMark: a ring filled by the position of the status in the configured list: the first status an empty ring, statuses in between a teal ring with a pie of position / (count - 1), the final status a filled ink disc with a check, a status that is not configured a dashed ring. In rows it is role="img" named after the status with a tooltip; beside a printed name it is hidden from assistive technology.
- PriorityBars: three bars; the filled count is the rank among the configured priorities scaled to three (ceil(rank * 3 / count)); named "<Priority> priority" or "No priority", with a tooltip.

6. Sidebar: "Kanban Board" and "All Tasks" become one "Tasks" entry, current on every /tasks and /board path. On those paths it links to the current layout, elsewhere to the remembered one. The "Tasks (N)" caption stays.

7. Board: unchanged behavior
- Columns per configured status in workflow order and the same order inside a column; drag and drop of one card and of a selection, the selection toolbar and Escape; every existing no-op guard; milestone lanes with collapse and progress; the column sort menu; cleanup on the final column; hide-empty-columns and its reveal during a drag; read-only cards from other branches; the update error banner and the loading skeleton.
- Changes: tokens instead of raw gray, blue and green; the status mark in column headers; priority bars and TaskTags on cards; cleanup as a labeled icon button in the final column header; heading, New task, lane switch and filters move to the page toolbar.

8. Mono details and colors: Geist Mono for IDs, counts, handles, branch names and dates. The page uses the tokens without dark: variants and focus-ring; every new text and mark pair is checked by calculation (text 4.5:1, marks 3:1, both themes) and recorded in the notes.

9. Tests
- New src/test/web-tasks-page.test.tsx: the switch keeps the query and follows the path; a reloaded URL restores layout and filters; each of the eight filters shows the same task IDs in both layouts; a search for a word that only task descriptions contain finds those tasks in both layouts and is written to the URL; canonical and legacy URL values; Clear filters keeps lane and unknown keys; the grouped list follows the `backlog task list --plain` order of the shared order fixture; the final group starts collapsed, opens with a Status filter and toggles; marks carry their text alternatives; a task from another branch shows its branch; the remembered layout.
- Changed: web-side-navigation-loading, web-task-detail-deeplink, web-board-filters, web-task-project, web-task-types, web-task-acceptance-progress, web-board-batch-move, web-task-column-sort (assertions on removed classes and texts become assertions on names, data and behavior). Removed: web-task-list-labels-menu and web-task-list-table-width (the table is gone; their URL rules move to the new file).

10. Verification
- bun run check:types, bun run check ., focused web tests, the full suite through scripts/run-ci-tests.ts, bun run build and scripts/smoke-compiled-build.ts.
- Criterion 9 in the compiled binary on a temporary project: List and Board in light and dark at 1440 and 390 px, the filter panel, a search, the final group open, milestone lanes, a selection and the static export; a keyboard-only pass; a contrast table for every new pair.
- codehygiene on the changed files, a cold simplicity review, then the specification and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (maintainer, 2026-11-24)
- List groups follow the configured workflow order through the shared sectionTasks(sortTasks(...)), exactly like `backlog task list --plain`, with one shared order inside each group: no column sorting and no sort menu.
- Filtering stays in the browser: one implementation in core (src/utils/task-search.ts, the code behind /api/search), run on the tasks the browser already holds, through the one URL parser in src/web/lib/task-filters.ts. Condition: if the browser ever stops holding every task (paging, BACK-260 or BACK-599 changing which tasks load, lazy loading of several projects in BACK-834), filtering moves to the server with the same core function, because filtering a partial set gives wrong answers. A comment where TasksPage calls applyTaskFilters says the same.

Rulings within the approved scope (2026-11-24): the header row stays as it is, with the "Tasks" title below it; a row shows the due date when set, and the milestone, ordinal and created columns are gone; the time since the last update uses the existing compact date; Status and Exclude status apply on the board too (columns stay, hide-empty-columns as before); quiet type and project chips (the colored palettes are gone); cards keep their dates and project; no Display menu, "+" per status, "Show all" or "Show older", Blocked chip or nested subtasks; the sidebar's Tasks entry and the start page open the layout last used in this browser, Board until one is chosen; "Project" stays as the word for the attribute; the final status group opens when the Status filter selects it; Clear filters also clears the search; a status that is not configured gets a dashed ring; custom priority lists are scaled to three bars; changing the lanes keeps the milestone filter; the page content lines up with the header row at every width.

Regressions the maintainer found on main, fixed by the one parser and applyTaskFilters
- `?labels=bug&labels=docs,support`: the board showed three tasks and the list one, because TaskList split only the first `labels` value on commas. readTaskFilters reads every `label` value and every legacy `labels` value split on commas, and applyTaskFilters keeps tasks with any of them. Test: "reads every label of the old comma-separated form in both layouts" in src/test/web-tasks-page.test.tsx; it fails when only the first legacy value is split.
- `?assignee=%40Alex`: the board matched only @Alex while /api/search matched @Alex and @alex. applyTaskFilters compares whole names, trimmed and lowercased, so both layouts match @Alex and @alex and not @alexa. Test: "matches an assignee in any letter case, but only the whole name, in both layouts"; it fails against a case-sensitive match. The Assignee filter now offers each name once in any letter case, spelled as the first task spells it (for @Alex, @alex and @alexa it shows "@Alex" and "@alexa"), and shows that option for any spelling in the URL.

Built differently from the plan, and why
- The Filter panel starts closed and the Filter button shows the number of active filters. Opening it from the URL was dropped: on a cold load the page mounts before the configuration arrives, so custom values could not be counted yet.
- Clear filters removes itself, so it gives keyboard focus to the Filter button instead of losing it (found in the keyboard pass).
- The first board column keeps its padding: without it the focus outline of its cards was cut by the scroll container.
- Board columns and lanes are named groups (role="group" with the status or lane name). The tests used to find a column by its "rounded-lg" class; a column's drag-over check also used a class name and now uses a ref.
- The Milestones page "Board" link named the start page, which now opens the remembered layout; it names /board now (found by the cold review).
- The canonical URL rewrite waits for a successful load, not only for the end of loading, so a failed load cannot strip custom values.
- The board's loading skeleton lost its message chip: no caller could reach it.
- writeTaskFilters keeps each filter where it stood in the query, so a canonical URL is never rewritten; the simpler delete-and-append version reordered every link with a filter before `lane`.
- Error states (the load error with Retry, the board's update error) keep the Tailwind red colors, as in BACK-828; the shared error states move to tokens in BACK-837. Retry got the focus ring.

Cold simplicity review (fresh agent with the task, the diff and the repository): one blocking finding, the Milestones Board link, fixed. Applied: the comments it found inaccurate (writeTaskFilters, the canonical rewrite, the lanes built from every task, what TaskList and Board own), a comment on why the lane toggle stores the mode before it changes the URL, finalGroupStartsOpen renamed finalGroupOpenByDefault, TaskFilterChoices no longer exported, the skeleton chip removed, and one panel-gutter utility for the header row and the page instead of seven copies of its padding. Left for follow-ups: App.tsx keeps its own milestone alias map (lanes.ts now exports the same canonicalizer); handleOpenTask and two dependency components still find the layout with their own startsWith checks; LabelFilterDropdown is named for labels but also serves statuses; prop names for priorities and projects still differ between Board, TaskColumn and TaskCard (availablePriorities, priorityOrder, priorities). codehygiene: the new files are clean; in the changed files it flags only JSX nesting and code this task did not touch.

Evidence by criterion
- AC1: /tasks is the List and /board the Board; the switch keeps the query and pushes history; a fresh render of a URL restores layout and filters; the deep-link tests for /board and /tasks task links, Back, Forward and the legacy highlight link pass unchanged in scenario. Tests: "switches between List and Board without losing the filters, and remembers the layout", "restores the layout and the filters from a URL opened afresh", src/test/web-task-detail-deeplink.test.tsx.
- AC2: one toolbar and filter panel for both layouts; ten filter cases plus the two regression cases show the same task IDs in the List and on the Board; canonical values, dropped values, legacy forms and Clear filters keeping `lane` and unknown keys are covered.
- AC3: typing "orchard", which only task descriptions contain, finds exactly those tasks in both layouts and writes `search=orchard`.
- AC4: with the shared order fixture the groups are To Do, In Progress, Done in that order and the rows are TASK-3, 1, 6, 5, then 2, then 4, as `backlog task list --plain` prints them; the Done group starts closed, shows its count, opens on Enter and opens by itself under a Status filter for Done.
- AC5: rows show priority bars, ID, status mark, title, branch, due date, type, project, labels, criteria ring, assignee and compact time (screenshots at 1440 and 390 px); a long title is cut with an ellipsis only where chips take the room, and narrow rows put the details on a second line.
- AC6: StatusMark is an empty ring, a teal pie of position/(count - 1), a check disc, or a dashed ring; PriorityBars fill ceil(rank * 3 / count) bars. Each is role="img" with a name ("In Progress", "now priority", "No priority"), checked by test; shapes differ, not only colors.
- AC7: the board tests for batch moves, drag and drop, hidden empty columns, the column sort menu, lane progress and cleanup pass; in the browser a card was selected with Ctrl+Enter and moved with Move to, lanes toggled, and the column menu opened and closed.
- AC8: one "Tasks" entry, current on /tasks and /board (aria-current="page"), and on other pages it opens the remembered layout (test in src/test/web-side-navigation-loading.test.tsx).
- AC9: the compiled binary (bun run build, version 1.57.4) served a temporary project outside the repository: four statuses, configured projects and labels, two milestones, 180 tasks with criteria, due dates and assignees, and one task on another branch. Checked in headless Chrome in light and dark at 1440 and 390 px: the list, a search, the filter panel, the final group open, the board, milestone lanes and a selection; and the static export (hash routes) of both layouts, read-only with no New task, cleanup or dragging, and the same 54 of 180 tasks for label=frontend in both layouts. Keyboard only, in light and dark: Tab reaches every control with the teal outline (the search field shows it on its frame); Enter opens the filter panel, a status menu and the column menu, Space checks a status, Escape closes each menu and returns focus to its button; Enter on a group header closes and opens it; Enter on a row or card opens the task, Escape closes it and focus returns to the row; Enter on Board and on Milestone lanes switches; Ctrl+Enter selects a card, typing in Move to picks Done, and Move moves it.
- AC10: src/test/web-tasks-page.test.tsx (29 tests) covers the switch and its URL, the filters shared between layouts and the grouped list.

Rebased onto origin/main after BACK-838 (browser live updates after reconnect): App.tsx and web-task-detail-deeplink.test.tsx merged without conflicts, BACK-838's reconnect code is untouched, and its tests (web-in-place-refresh, web-app-open-detail-refresh, web-dependency-cleanup-notice) pass.

Contrast (WCAG 2, every new pair, both themes; text needs 4.5:1, marks 3:1)
| Pair (foreground on background) | Light | Dark | Needed |
| --- | --- | --- | --- |
| Title, row titles, card titles, column and group names, select text, menu items (ink) | 13.51 on surface, 11.90 on surface-2, 11.59 on hover | 14.84 on surface, 13.33 on surface-2, 12.07 on hover | 4.5 |
| Counts, IDs, times, empty-state hints, search placeholder, '+N' (ink-3) | 5.77 on surface, 5.08 on surface-2, 4.95 on hover | 5.97 on surface, 5.36 on surface-2, 4.85 on hover | 4.5 |
| Chips, assignees, branch, due date, quiet buttons, criteria count, non-current layout link (ink-2) | 6.75 on surface, 5.94 on surface-2, 5.79 on hover | 8.92 on surface, 8.01 on surface-2, 7.25 on hover | 4.5 |
| New task button, drag tooltip and drag badge (on-ink) | 13.51 on ink | 15.91 on ink | 4.5 |
| Clear status or label filter link, drop zone text (accent-text) | 5.76 on surface, 4.94 on hover | 9.60 on surface, 7.81 on hover | 4.5 |
| Status mark: first status ring, unconfigured dashed ring (ink-3) | 5.77 on surface, 5.08 on surface-2, 4.95 on hover | 5.97 on surface, 5.36 on surface-2, 4.85 on hover | 3 |
| Status mark: statuses in between (ring and pie); criteria ring arc (accent-strong) | 4.15 on surface, 3.66 on surface-2, 3.56 on hover | 7.87 on surface, 7.07 on surface-2, 6.40 on hover | 3 |
| Status mark: final status disc (ink) | 13.51 on surface, 11.90 on surface-2, 11.59 on hover | 14.84 on surface, 13.33 on surface-2, 12.07 on hover | 3 |
| Status mark: check on the final status disc (surface) | 13.51 on ink | 14.84 on ink | 3 |
| Priority bars: filled bars; branch and project icons; cleanup and column-menu icons (ink-2) | 6.75 on surface, 5.94 on surface-2, 5.79 on hover | 8.92 on surface, 8.01 on surface-2, 7.25 on hover | 3 |
| Card selection ring, drop indicator, drop zone border, focus ring (accent-strong) | 3.79 on paper, 4.15 on surface, 3.56 on hover | 8.43 on paper, 7.87 on surface, 6.40 on hover | 3 |
| Lane progress fill against its track (ink) | 9.93 on line | 10.19 on line | 3 |
| Empty priority bars, criteria ring track, chip outlines, separators (decorative) (line) | 1.36 on surface, 1.17 on hover | 1.46 on surface, 1.19 on hover | none |
Every required pair passes. The empty priority bars, the criteria ring track, chip outlines and separators are decorative: the filled bars, the arc, the counts and the text alternatives carry the information.

Checks, after the rebase: bun run check:types and bun run check pass; the web tests (399) pass; the full suite through scripts/run-ci-tests.ts with the CI flags (--profile=full --parallel=2 --isolate --timeout=10000 --max-concurrency=2 and the bundled test CLI) passes: 3148 tests and 13 skipped in the parallel pass, 406 in the DOM pass. bun run build and `bun scripts/smoke-compiled-build.ts dist/backlog 1.57.4` pass. A run without the CI flags (one process, no isolation) fails 24 CLI, decision and server tests that this change does not touch; they pass alone and with the CI flags, so they share state in that mode.

Not verified: Firefox, Safari, Windows and Linux; a mouse drag in a real browser (covered by the tests; the keyboard move was checked in the browser); what a screen reader announces (only the accessible names were checked).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One Tasks page replaces the Kanban board and All Tasks. /tasks shows the List layout and /board the Board layout; the switch keeps the query string, so the filters, the search and the board's lanes stay applied, and existing /board and /tasks links, task links included, keep working. TasksPage reads the filters from the URL through src/web/lib/task-filters.ts and narrows the tasks once with the shared applyTaskFilters, so the search and the eight filters mean in both layouts what they mean in the CLI, the TUI and MCP. The List groups tasks by status in the order of `backlog task list --plain`, with the final status closed; rows and cards share StatusMark, PriorityBars, TaskTags, TaskBranch and CleanupButton on the BACK-828 tokens, and the board keeps its behavior. The sidebar has one Tasks entry, and it and the start page open the layout used last.

Verified with the type check, Biome, the web tests, the full suite with the CI flags, the compiled-binary smoke script, and checks of the compiled binary in light and dark at 1440 and 390 px, of the static export and with the keyboard alone. Follow-ups, not started: App.tsx keeps its own milestone alias map; prop names for priorities and projects differ between Board, TaskColumn and TaskCard; LabelFilterDropdown also serves statuses under its label-only name. Not checked in Firefox, Safari, Windows or Linux.
<!-- SECTION:FINAL_SUMMARY:END -->
