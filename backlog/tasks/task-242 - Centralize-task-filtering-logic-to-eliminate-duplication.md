---
id: task-242
title: Centralize task filtering logic to eliminate duplication
status: To Do
assignee:
  - '@codex'
created_date: '2025-08-23 18:46'
updated_date: '2025-08-26 16:41'
labels:
  - refactoring
  - backend
  - cli
dependencies: []
ordinal: 0
---

## Description

Both the CLI task list command and the web server handlers implement their own task filtering by status and assignee. This duplication suggests the need for a shared filtering utility or an extension to FileSystem.listTasks that accepts filter criteria so both interfaces can reuse the logic.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Filtering by status and assignee is centralized in a shared helper or FileSystem API
- [ ] #2 CLI task list uses the shared filtering mechanism
- [ ] #3 Server task listing uses the shared filtering mechanism
- [ ] #4 Unit tests cover filtering for status and assignee
<!-- AC:END -->
