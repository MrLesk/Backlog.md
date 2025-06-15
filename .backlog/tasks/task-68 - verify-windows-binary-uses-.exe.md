---
id: task-68
title: Verify Windows binary uses .exe
status: In Progress
assignee: @codex
created_date: '2025-06-15'
labels:
  - packaging
dependencies: []
---

## Description
Ensure the platform wrapper scripts select the correct compiled binary on Windows.
The executable should include the `.exe` suffix so that global installation works
with `npx` and `bunx`.

## Acceptance Criteria
- [ ] `cli.cjs` resolves `backlog.exe` when `process.platform` is `win32`.
- [ ] `cli-download.cjs` downloads `backlog.exe` on Windows.
- [ ] Unit tests cover these behaviors.
