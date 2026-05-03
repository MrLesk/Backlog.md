---
id: BACK-462
title: Use terminal status for cleanup instead of hardcoded Done
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-03 18:18'
updated_date: '2026-05-03 18:23'
labels:
  - bug
  - web
  - cleanup
dependencies: []
modified_files:
  - src/utils/terminal-status.ts
  - src/core/backlog.ts
  - src/server/index.ts
  - src/cli.ts
  - src/web/components/Board.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/components/TaskList.tsx
  - src/test/cleanup.test.ts
  - src/test/server-cleanup-endpoint.test.ts
  - src/test/web-board-filters.test.tsx
  - src/test/web-task-column-sort.test.tsx
  - src/test/web-task-list-labels-menu.test.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cleanup must apply to the terminal Kanban status defined by the configured statuses array, not only a literal `Done` status. Users can rename the final workflow column to values such as `Closed`, and the web cleanup affordance plus backend cleanup selection should still agree on that terminal column.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When the final configured status is renamed, the board cleanup affordance appears on that final column and not on earlier columns.
- [ ] #2 The cleanup preview and execute endpoints select tasks in the final configured status rather than requiring `Done`.
- [ ] #3 The task list cleanup affordance follows the same terminal-status rule when filtering by status.
- [ ] #4 Existing default `To Do`, `In Progress`, `Done` projects keep the current cleanup behavior.
- [ ] #5 Targeted tests cover a non-`Done` terminal status.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one pure terminal-status helper based on the final configured status.
2. Use that helper in backend cleanup selection plus server and CLI cleanup flows.
3. Use the same terminal-status rule for web board and task-list cleanup affordances.
4. Add regression tests for a non-`Done` terminal status in core cleanup, server cleanup, board, task column, and task list.
5. Run targeted tests, typecheck, and Biome.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
