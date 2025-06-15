---
id: task-74
title: Fix TUI crash on Windows by disabling blessed tput
status: Done
assignee:
  - '@codex'
created_date: '2025-06-15'
updated_date: '2025-06-15'
labels:
  - bug
  - windows
dependencies: []
---

## Description

Windows builds fail when board view tries to load built-in terminfo. Initialize blessed program with tput:false

## Acceptance Criteria
- [ ] All TUI screens create a program with `{ tput: false }` and pass it to `blessed.screen()`
- [ ] Windows binary runs `backlog board view` without ENOENT or isAlt errors
- [ ] Tests updated to reflect new initialization

## Implementation Notes
- Wrap screen initialization in helper to reuse across modules
