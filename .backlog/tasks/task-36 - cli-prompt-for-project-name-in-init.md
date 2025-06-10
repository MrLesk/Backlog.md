---
id: task-36
title: 'CLI: Prompt for project name in init'
status: Done
assignee:
  - '@codex'
created_date: '2025-06-10'
updated_date: '2025-06-10'
labels: []
dependencies: []
---

## Description

Allow `backlog init` to run without specifying a project name. When omitted, the CLI should prompt for the name before proceeding.

## Acceptance Criteria
- [x] `backlog init` works without project name parameter
- [x] When project name is missing, CLI prompts for it before initialization
- [x] Task committed to repository

## Implementation Notes
- Updated `src/cli.ts` to accept optional project name and prompt when omitted.
- Added integration test covering prompt behavior in `src/test/cli.test.ts`.
