---
id: BACK-217.03
title: 'Sequences web UI: move tasks and update dependencies'
status: To Do
assignee: []
created_date: '2025-08-23 19:13'
updated_date: '2026-05-17 20:27'
labels:
  - sequences
milestone: m-10
dependencies:
  - BACK-474
parent_task_id: BACK-217
priority: low
ordinal: 156000
---

## Description

Enable moving tasks within/between sequences; call the move endpoint to update dependencies and refresh state.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dragging (or keyboard) moves tasks using join semantics: set moved deps to previous sequence only; other tasks unchanged
- [ ] #2 Moving to Unsequenced allowed only if task is isolated; otherwise show clear error and do not move
- [ ] #3 After move, refresh state from server and preserve scroll/focus; provide success feedback
<!-- AC:END -->
