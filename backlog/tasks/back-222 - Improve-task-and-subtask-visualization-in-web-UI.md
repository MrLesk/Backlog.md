---
id: BACK-222
title: Improve task and subtask visualization in web UI
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The current web UI doesn't effectively visualize the parent-child relationship between tasks and subtasks. While the data model supports hierarchical tasks through parentTaskId and subtasks fields, the UI presents all tasks at the same level without clear visual hierarchy.

## Acceptance Criteria

- [ ] Parent tasks visually indicate they have subtasks (badge or icon)
- [ ] Subtasks are displayed with visual hierarchy (indentation or nesting)
- [ ] Users can expand/collapse subtask groups in the board view
- [ ] Parent task cards show subtask completion progress (e.g. "3/5 complete")
- [ ] Subtasks can be created directly from parent task cards
- [ ] Task hierarchy is preserved when dragging tasks between columns
- [ ] Board view has toggle option to show/hide subtasks
- [ ] Parent-child relationships are clear and intuitive to users
- [ ] Agent instructions improved to reflect usage of subtasks
