---
id: task-52
title: 'CLI: Filter tasks list by status or assignee'
status: Done
assignee:
  - '@codex'
created_date: '2025-06-13'
updated_date: '2025-06-13'
labels: []
dependencies: []
---

## Description

Add filtering options to task list command

## Acceptance Criteria
- [ ] `backlog task list --status "To Do"` filters by status
- [ ] `backlog task list --assignee user` filters by assignee

## Implementation Notes
Implemented filtering options in src/cli.ts and added tests.
