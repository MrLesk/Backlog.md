---
id: task-72
title: Fix board view on Windows without terminfo
status: To Do
assignee: []
created_date: '2025-06-15'
labels:
  - bug
  - windows
---

## Description
`backlog board view` fails on Windows with an error similar to:
```
ENOENT: no such file or directory, open 'C:\a\Backlog.md\Backlog.md\node_modules\blessed\usr\xterm'
```
The compiled CLI looks for blessed's terminfo files relative to the build path. When installed globally, this path does not exist. Disable blessed's Tput initialization by passing `tput: false` when creating screens so board and other UI screens work without terminfo files.

## Acceptance Criteria
- [x] All `blessed.screen` calls use `{ tput: false }`
- [x] Windows build runs `backlog board view` without ENOENT errors
- [x] Tests updated and passing

## Implementation Notes
- Disabled `Tput` in every screen creation to avoid missing terminfo files on Windows.
- Updated `line-wrapping.test.ts` to pass `{ tput: false }` when creating screens.
- Verified the board view works on Windows without ENOENT errors.
