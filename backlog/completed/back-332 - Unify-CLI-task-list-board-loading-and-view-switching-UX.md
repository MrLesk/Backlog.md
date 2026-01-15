---
id: BACK-332
title: Unify CLI task list/board loading and view switching UX
status: Done
assignee:
  - '@codex'
created_date: '2025-12-03 18:33'
updated_date: '2025-12-03 18:40'
labels:
  - cli
  - ux
  - loading
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task list UI currently skips the loading screen while board shows one; data loading is split between commands and view logic. Extend task-330 work to centralize task loading in runUnifiedView, share a single progress UI, and keep view switching state consistent so both task list and board reuse the same loader/state pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 runUnifiedView owns task loading via a single loader/progress callback used by both initial entry points and Tab switches.
- [x] #2 Task list and board flows both show a loading/progress indicator when data is not yet available; no blank screens during loading.
- [x] #3 View switching preserves selected task and filters without reloading data unnecessarily (state machine handles view + selection).
- [x] #4 Duplicated loading logic in CLI commands is removed in favor of shared loader/state in unified-view.
- [x] #5 Automated tests updated/added to cover loading indicator presence and non-regressive behavior for task list/board entry.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented unified loading pipeline: runUnifiedView now owns task loading with a shared progress screen via tasksLoader and loadTasksForUnifiedView helper; task list and board entry points delegate to it, removing duplicated loaders. View switching preserves state with preloaded tasks/statuses and handles empty states gracefully. Added regression test for loader progress/closing (src/test/unified-view-loading.test.ts). Ran bun test, bunx tsc --noEmit, bun run check . (Biome still reports existing noExplicitAny warnings in src/test/find-task-in-branches.test.ts).
<!-- SECTION:NOTES:END -->
