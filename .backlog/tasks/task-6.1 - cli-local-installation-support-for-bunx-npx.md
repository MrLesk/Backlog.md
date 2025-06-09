---
id: task-6.1
title: 'CLI: Local installation support for bunx/npx'
status: Done
assignee: []
created_date: '2025-06-08'
updated_date: '2025-06-09'
labels:
  - cli
dependencies: []
parent_task_id: task-6
---
## Description

Allow installing Backlog.md locally in JS projects so agents can run bunx/npx backlog create when global install isn't available.

## Acceptance Criteria

- [x] Remove `"private": true` from package.json to allow publishing
- [x] Configure proper package name/scope for npm registry
- [x] Test and verify `npx backlog` and `bunx backlog` work from any project directory
- [x] Update documentation with local installation instructions

## Implementation Notes

- `package.json` now includes a version and is publishable
- `readme.md` documents local installation using `npm install backlog.md`
- Added `local-install.test.ts` to verify execution via `npx` and `bun x`
