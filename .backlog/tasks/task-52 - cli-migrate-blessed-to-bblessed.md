---
id: task-52
title: 'CLI: migrate blessed to bblessed'
status: In Progress
assignee:
  - '@codex'
created_date: '2025-06-13'
labels:
  - cli
dependencies: []
---

## Description

Replace the current `blessed` dependency with the `bblessed` fork to ensure
compatibility with Bun while keeping Node support intact.

## Acceptance Criteria
- [ ] `package.json` lists `bblessed` instead of `blessed`
- [ ] `bun.lock` updated after installing the new dependency
- [ ] Source imports updated to use `bblessed`
- [ ] All tests pass on both Node and Bun
