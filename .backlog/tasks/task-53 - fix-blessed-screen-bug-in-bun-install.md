---
id: task-53
title: Fix blessed screen bug in Bun install
status: Done
assignee:
  - '@codex'
created_date: '2025-06-13'
updated_date: '2025-06-13'
labels:
  - bug
dependencies: []
---

## Description

Global install via `bun add -g backlog.md` results in a runtime error:
`TypeError: blessed.screen is not a function`. The init command fails
because the optional blessed dependency does not load correctly when the
CLI is executed with Bun.

## Acceptance Criteria
- [x] Installing the package globally with Bun runs `backlog init` without errors
- [x] Tests cover Bun execution path for loading blessed
- [x] Documentation explains Bun global install support

## Implementation Notes
Fixed loadBlessed() to prefer dynamic import which works under Bun.
Updated README with note about Bun global install.
Added regression test for blessed prompt (line-wrapping).
