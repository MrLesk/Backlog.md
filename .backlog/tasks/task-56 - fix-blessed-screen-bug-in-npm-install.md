---
id: task-56
title: Fix blessed screen bug in NPM install
status: Done
assignee:
  - '@codex'
created_date: '2025-06-14'
labels:
  - bug
dependencies: []
---

## Description
`blessed.screen` is undefined when running `backlog board` after installing the package from npm.
Local builds work fine, so the bundling step likely strips part of the blessed module.
Fix the package so blessed loads correctly in Node-based npm installs.

## Acceptance Criteria
- [x] `npm install -g backlog.md@next` allows running `backlog board` without errors
- [x] Unit test covers `renderBoardTui` when blessed loads via `createRequire`
- [x] README notes the fix and NPM install instructions

## Implementation Notes
- Updated `loadBlessed` in `src/ui/board.ts` to use dynamic import first and fall back to `createRequire`, mirroring previous fix for bun installs.
- Ensures the bundled executable loads `blessed` properly when installed via npm.
