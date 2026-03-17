---
id: BACK-404
title: Harden task ID locking for concurrent create/promote/demote operations
status: Done
assignee: []
created_date: '2026-03-17 14:07'
updated_date: '2026-03-17 14:07'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Concurrent create-like operations in Backlog.md were allocating IDs from unlocked repository state. When two task creates, draft promotions, or task demotions overlapped, both operations could observe the same highest ID and then race to write the same next ID.

This work hardens task ID allocation with a repository-scoped lock around the critical file-mutation window, while preserving existing create semantics such as repo-driven auto-commit behavior and cross-branch dependency validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Concurrent task create operations produce unique IDs
- [x] #2 Concurrent draft promote operations produce unique task IDs
- [x] #3 Concurrent task demote operations produce unique draft IDs
- [x] #4 Create-lock contention surfaces a clear user-facing error
- [x] #5 Non-wizard CLI create commands still honor repo autoCommit configuration
- [x] #6 Task create dependency validation still accepts tasks visible from other active branches
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the ad hoc create lock with a maintained lock implementation that supports retries, timeout handling, and stale-lock recovery.
2. Narrow the critical section so only ID allocation and file mutations are serialized, leaving git auto-commit and other post-write work outside the lock.
3. Add deterministic concurrency coverage for create, promote, demote, and timeout scenarios, plus a real parallel smoke test.
4. Preserve existing CLI semantics by keeping repo-configured auto-commit behavior and cross-branch dependency validation intact.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the lock in `src/file-system/operations.ts` with `proper-lockfile`, standardized user-facing create-lock errors, and preserved the `USE_GLOBAL_TASK_ID_LOCK=false` escape hatch.

Refactored `src/core/backlog.ts` so create/promote/demote hold the lock only while allocating IDs and mutating files. Content-store refreshes, console output, and git commit work now happen after the lock is released.

Added deterministic regression coverage in `src/test/atomic-task-create.test.ts` for concurrent create, promote, demote, and timeout behavior, plus a repository-level smoke script at `scripts/smoke-parallel-task-locking.sh`.

Follow-up fixes preserved prior behavior in the CLI create path: non-wizard `task create` / `draft create` once again honor repo `autoCommit: true`, and dependency validation continues to accept tasks visible from other active branches by validating through `queryTasks()`.
<!-- SECTION:NOTES:END -->
