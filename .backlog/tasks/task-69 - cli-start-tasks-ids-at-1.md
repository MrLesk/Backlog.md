---
id: task-69
title: 'CLI: start tasks IDs at 1'
status: In Progress
assignee:
  - '@codex'
created_date: '2025-06-15'
updated_date: '2025-06-15'
labels: []
dependencies: []
---

## Description

Ensure the CLI starts numbering tasks from **1** rather than **0** when a new
project is initialized. Currently, the ID generator returns `task-0` for the
first task which can be confusing.

## Acceptance Criteria

- [ ] `generateNextId()` returns `task-1` when no tasks exist
- [ ] `backlog init` followed by `backlog task create` produces a file named
  `task-1 - <title>.md`
- [ ] Unit test verifies ID generation starts at 1
