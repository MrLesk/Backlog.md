---
id: BACK-222
title: Improve parent and subtask presentation in the Web UI
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2026-11-23T20:54:00Z'
labels: []
dependencies:
  - BACK-829
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve how the Web UI presents existing parent and subtask relationships across the board, All Tasks, and task detail views. Make hierarchy, status, progress, and navigation clear and accessible while preserving the current task model and mutation behavior. The browser remains desktop-first with best-effort mobile behavior.

Direction from the maintainer on 2026-11-23, given while reviewing the web redesign drawings: tasks nested four or five levels deep must show together; each level opens and closes like an accordion, so deep nesting does not break the layout; and a task that has nested tasks must show that clearly while it is closed.

What the approved drawings show:

- Every task with subtasks carries a marker with the number of finished and total direct subtasks. The marker is also the control that opens them in place.
- In the list, opened subtasks sit under their parent as a tree with one guide line per level, and the columns on the right stay aligned at every depth.
- On the board, a parent card ends in a bar with the subtask count. Opening it lists the subtasks inside the card, level by level. A subtask keeps its own card in the column of its status, with a link to its parent.
- The task view has a Subtasks section with the same tree and the same markers.

To confirm with the maintainer at plan review: where a subtask appears in the list when its status differs from the status of its parent.

This task follows the slice that merges the board and All Tasks into one Tasks page, so the tree is built once for the list and the board.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The board, All Tasks, and task detail views clearly distinguish parent tasks from child tasks and show each related task’s ID, title, and status wherever that context is needed.
- [ ] #2 Parent progress summarizes completed children using the project’s configured terminal-status semantics, while tasks with no children retain an uncluttered no-child state.
- [ ] #3 Parent-to-child and child-to-parent navigation uses canonical task routes, and close/back behavior predictably returns users to their prior context.
- [ ] #4 Tasks with many children and tasks with nested descendants remain discoverable, readable, and usable without obscuring the hierarchy.
- [ ] #5 The change does not alter task or subtask creation, editing, ordering, dragging or movement behavior, or the semantics of parent-child relationships.
- [ ] #6 Hierarchy and parent-child navigation are accessible to keyboard and assistive-technology users, with clear semantics, labels, focus order, and focus return.
- [ ] #7 Rendered QA covers the board, All Tasks, and task detail views on desktop and best-effort mobile widths, in light and dark themes, for empty, large, and nested child sets.
- [ ] #8 Automated tests cover hierarchy rendering, terminal-status progress, canonical navigation and close/back behavior, and empty, large, and nested edge cases.
- [ ] #9 A task with subtasks shows a marker with the number of finished and total direct subtasks that opens them in place, and every level opens and closes on its own.
- [ ] #10 Tasks nested five levels deep stay readable in the list, on the board and in the task view, and deeper levels never push the other columns or widen a card.
<!-- AC:END -->
