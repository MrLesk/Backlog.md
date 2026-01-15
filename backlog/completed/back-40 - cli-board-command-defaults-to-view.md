---
id: BACK-40
title: 'CLI: Board command defaults to view'
status: Done
assignee:
  - '@codex'
created_date: '2025-06-10'
updated_date: '2025-06-10'
labels:
  - cli
dependencies: []
---

## Description

Make 'backlog board' show the kanban board the same as 'backlog board view'.

## Acceptance Criteria
- [x] Running `backlog board` shows the kanban board
- [x] `backlog board view` remains functional
- [x] Task committed to repository

## Implementation Notes

The implementation was completed by modifying the CLI command structure in `src/cli.ts`:

1. **Added direct action handler to board command** (line 497): The main `boardCmd` now has an action handler that calls `handleBoardView`, making `backlog board` display the kanban board directly.

2. **Preserved existing view subcommand** (line 499): The `board view` subcommand remains functional and uses the same `handleBoardView` function.

3. **Shared implementation**: Both commands use the identical `handleBoardView` function with the same options, ensuring consistent behavior.

4. **Testing**: Added test coverage in `src/test/cli.test.ts` that verifies `backlog board` produces the same output as `backlog board view`.

**Key architectural decisions:**
- Used the same `handleBoardView` function for both commands to avoid code duplication
- Preserved the existing `board view` command for backward compatibility
- Both commands support the same options (`--layout`, `--vertical`) for consistent UX
