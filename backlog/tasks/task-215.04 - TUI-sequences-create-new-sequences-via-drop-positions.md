---
id: task-215.04
title: 'TUI sequences: create new sequences via drop positions'
status: To Do
assignee: []
created_date: '2025-08-23 19:12'
updated_date: '2025-08-26 16:46'
labels:
  - sequences
dependencies: []
parent_task_id: task-215
---

## Description

Allow creating a new sequence by placing a task between existing sequences (top/bottom included) and update dependencies accordingly.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Show drop zones only between numbered sequences (Unsequenced is not a sequence)
- [ ] #2 Dropping between Sequence K and K+1 creates a new Sequence K+1 containing the moved task; sequences at and after K+1 shift down by one
- [ ] #3 Dependencies updated: moved task depends on prior sequence (K); all tasks in the next sequence depend on the moved task
- [ ] #4 Clear visual drop indicators while moving; apply on drop; cancel with Esc
<!-- AC:END -->
