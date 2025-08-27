---
id: task-217.03
title: 'Sequences web UI: move tasks and update dependencies'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:13'
updated_date: '2025-08-27 01:05'
labels:
  - sequences
dependencies: []
parent_task_id: task-217
---

## Description

Enable moving tasks within/between sequences; call the move endpoint to update dependencies and refresh state.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dragging (or keyboard) moves tasks using join semantics: set moved deps to previous sequence only; other tasks unchanged
- [x] #2 Moving to Unsequenced allowed only if task is isolated; otherwise show clear error and do not move
- [x] #3 After move, refresh state from server and preserve scroll/focus; provide success feedback
<!-- AC:END -->

## Implementation Notes

Implemented task movement with server updates
