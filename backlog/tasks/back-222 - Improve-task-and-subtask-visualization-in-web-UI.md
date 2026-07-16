---
id: BACK-222
title: Improve parent and subtask presentation in the Web UI
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2026-07-16 21:49'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve how the Web UI presents existing parent and subtask relationships across the board, All Tasks, and task detail views. Make hierarchy, status, progress, and navigation clear and accessible while preserving the current task model and mutation behavior. The browser remains desktop-first with best-effort mobile behavior.
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
<!-- AC:END -->
