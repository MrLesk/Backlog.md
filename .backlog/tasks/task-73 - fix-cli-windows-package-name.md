---
id: task-73
title: Fix Windows binary package name resolution
status: In Progress
assignee:
  - '@codex'
created_date: '2025-06-15'
labels:
  - bug
  - windows
  - packaging
dependencies: []
---

## Description
`backlog board view` fails on Windows with:
```
Binary package not installed for win32-x64.
```
The CLI wrapper computes the package name using `process.platform` directly, producing `backlog.md-win32-x64`. However the published package for Windows is `backlog.md-windows-x64`. Add a mapping so Windows uses the correct package name.

## Acceptance Criteria
- [ ] CLI resolves `backlog.md-windows-x64` on Windows and spawns the binary successfully.
- [ ] Tests cover the platform mapping logic.
- [ ] Release workflow includes any new script files.

