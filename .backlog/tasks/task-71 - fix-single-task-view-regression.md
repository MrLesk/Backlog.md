---
id: task-71
title: Fix single task view regression
status: In Progress
assignee:
  - '@codex'
created_date: '2025-06-15'
updated_date: '2025-06-15'
labels: []
dependencies: []
---

## Description
The `backlog task <task-id>` command should launch the interactive task viewer with the specified task pre-selected. At the moment it only displays the raw task content, losing the enhanced UI used by `backlog task view` and `backlog task list`.

## Acceptance Criteria
- [ ] Running `backlog task <task-id>` opens the same viewer as `task view <task-id>`
- [ ] The specified task is pre-selected in the list pane
- [ ] Plain text output in non-TTY environments remains unchanged
- [ ] Tests cover this regression fix

