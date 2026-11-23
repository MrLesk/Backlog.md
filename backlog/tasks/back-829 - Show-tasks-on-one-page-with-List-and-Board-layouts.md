---
id: BACK-829
title: Show tasks on one page with List and Board layouts
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - web
dependencies:
  - BACK-828
references:
  - src/web/components/BoardPage.tsx
  - src/web/components/Board.tsx
  - src/web/components/TaskList.tsx
  - src/web/App.tsx
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
- [ ] #1 One Tasks page offers a List and a Board layout through a switch. The chosen layout is part of the URL, survives a reload, and existing /board and /tasks links, including links to a task, keep working.
- [ ] #2 Both layouts share one toolbar with the filters either page has today (status, excluded status, assignee, labels, type, project, priority, milestone), Clear filters and New task. A filter stays applied when the layout changes and is restored from the URL.
- [ ] #3 The toolbar has a text search that narrows the visible tasks through the shared task search.
- [ ] #4 The list groups tasks by status under collapsible headers that show the status name and count, keeps the shared task ordering inside each group, and starts with the final status collapsed.
- [ ] #5 A list row shows priority, ID, status, title, labels and type, acceptance-criteria progress, assignee, the branch for a task from another branch, and the time since the last update. The title uses the free width and is cut with an ellipsis only when it does not fit.
- [ ] #6 Status is shown by a mark whose fill follows the position of the status in the configured workflow, and priority by three bars. Both have a text alternative for assistive technology and do not rely on color alone.
- [ ] #7 The board keeps what it does today: one column per status in workflow order, drag and drop of one or several selected cards, milestone lanes, the column sort menu, cleanup on the final column and the hide-empty-columns setting.
- [ ] #8 The sidebar has one Tasks entry in place of Kanban Board and All Tasks.
- [ ] #9 The page is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone.
- [ ] #10 Tests cover the layout switch and its URL state, filters shared between layouts, and the grouped list.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
