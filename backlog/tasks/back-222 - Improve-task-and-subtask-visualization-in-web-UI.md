---
id: BACK-222
title: Show nested tasks together on the Tasks page and in the task view
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2026-11-24T22:42:00Z'
labels:
  - web
dependencies:
  - BACK-829
references:
  - src/utils/task-subtasks.ts
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
- [ ] #1 On the Tasks page, a task with subtasks shows a marker in its List row and on its Board card with the number of finished and total direct subtasks, where finished means the configured final status; a task without subtasks shows no marker.
- [ ] #2 The marker opens and closes the task's direct subtasks in place, every level opens and closes on its own, and the open state can be reached and changed with the keyboard and is announced to assistive technology.
- [ ] #3 In the List, opened subtasks show under their parent as a tree with one guide line per level, and the other columns stay aligned at every depth.
- [ ] #4 On the Board, a parent card ends in a bar with its subtask count that opens the subtasks inside the card level by level, and each subtask keeps its own card in the column of its status with a link to its parent.
- [ ] #5 The task dialog shows the task's parent and a Subtasks section with the same tree and markers; opening a parent or a subtask from it uses the task routes, and closing returns to where the person came from.
- [ ] #6 Tasks nested five levels deep stay readable in the List, on the Board and in the task dialog, and deeper levels never push the other List columns or widen a card.
- [ ] #7 Every task stays findable in both layouts whatever the status of its parent and whatever filters apply, and a subtask shown apart from its parent can be traced to it.
- [ ] #8 Creating, editing, ordering, dragging and moving tasks work as before, and what parent and subtask mean does not change.
- [ ] #9 The page is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone, for tasks without subtasks, with many subtasks and nested five levels deep.
- [ ] #10 Tests cover the marker count against a configured final status, opening and closing levels, the List tree, the Board card, five levels of nesting and the task dialog's Subtasks section.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
