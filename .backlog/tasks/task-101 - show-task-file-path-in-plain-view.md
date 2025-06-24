---
id: task-101
title: Show task file path in plain view
status: To Do
assignee: []
created_date: '2025-06-24'
labels: []
dependencies: []
---

## Description

Update the `backlog task <id> --plain` and `backlog draft <id> --plain` commands to include the full file path of the markdown file being viewed. This allows AI agents to locate the task or draft in the repository.

## Acceptance Criteria

- [ ] `backlog task <id> --plain` outputs the markdown file path.
- [ ] `backlog draft <id> --plain` outputs the markdown file path.
- [ ] Unit tests cover both commands.
