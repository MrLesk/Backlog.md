---
id: task-94
title: Add priority field to tasks
status: To Do
assignee: []
created_date: '2025-06-20'
labels:
  - enhancement
dependencies: []
---

## Description

Add support for assigning a priority level to each task so that work can be
ordered by importance. The CLI should allow setting the priority when creating
or editing tasks, and the board view should display it.

## Acceptance Criteria

- [ ] Tasks support priority metadata
- [ ] CLI accepts --priority
- [ ] Board shows priority
- [ ] Docs updated
- [ ] Tests added

## Implementation Plan

1. Update Task type to include priority (high|medium|low)
2. Extend CLI create/edit with `--priority` option
3. Display priority in list and board
4. Update docs and tests
