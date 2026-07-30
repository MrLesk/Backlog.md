---
id: BACK-559
title: Eliminate repeated task-corpus scans from browser updates
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 17:12'
updated_date: '2026-07-30 17:36'
labels:
  - web-ui
  - performance
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/807'
modified_files:
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/core/duplicate-task-repair.ts
  - src/server/index.ts
  - src/web/App.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/test/core.test.ts
  - src/test/duplicate-task-repair.test.ts
  - src/test/reorder-utils.test.ts
  - src/test/server-duplicate-repair.test.ts
  - src/test/web-board-filters.test.tsx
type: bug
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser task mutations repeatedly parse the complete active and completed task corpus. With 20 active and 430 completed tasks, a status update regressed from roughly 3 ms in v1.47.0 to roughly 607 ms on current main, while duplicate repair preview adds about 202 ms and the board can request a second refresh. Resolve task identity once per mutation, reuse one active/completed snapshot for duplicate repair, and avoid redundant board refresh work while preserving fail-closed identity behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One ordinary browser task status update performs at most one active/completed identity scan, persists the change, and returns the updated task.
- [ ] #2 Duplicate repair preview loads active and completed tasks once and reuses that snapshot for duplicate detection, existing-ID allocation input, and fingerprint preparation.
- [ ] #3 One board drag applies the returned task immediately and does not cause two duplicate-plan builds; the existing WebSocket refresh still reconciles external changes.
- [ ] #4 Fail-closed behavior remains for active/active, active/completed, zero-padded, cross-prefix, and filename/frontmatter ID collisions, and ambiguous mutations alter no file.
- [ ] #5 Completed tasks remain excluded from the active board, and current auto-commit, Git staging and commit, updated-date, and status callback behavior remains unchanged.
- [ ] #6 An ephemeral same-machine fixture with 20 active and 430 completed tasks records before and after status-update, duplicate-preview, and drag-path measurements with at least a 70 percent reduction in the combined mutation and refresh median; no durable benchmark framework is added.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused regression tests first: count active/completed corpus loads for one HTTP task mutation and one duplicate preview; assert ambiguous active/active, active/completed, zero-padded, cross-prefix, and filename/frontmatter mutations remain fail-closed without file changes; assert a board reorder applies the returned task without invoking a foreground refresh. Baseline on the 20-active/430-completed fixture: status PUT median 607.8 ms, duplicate preview 201.7 ms, full refresh 202.5 ms on current main.
2. Collapse task persistence around the already-resolved original task: remove the server pre-read, preserve the one FileSystem identity scan, pass the original into a private persistence path, use the save result for ContentStore/Git, and return the updated task without reloading the corpus. Reuse one active/completed snapshot throughout duplicate detection and local repair-ID allocation.
3. Apply the reorder response to App task state immediately and leave the existing WebSocket refresh as reconciliation. Run focused server/collision/Web tests, type-check, Biome, broader relevant tests, an ephemeral same-machine 20/430 before/after measurement, rendered-browser validation where available, simplification review, and final scoped diff inspection.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the browser mutation fast path around one resolved task identity and one reusable active/completed snapshot. Core task updates now persist the resolved task directly, exact-parse only the saved file for normalized response data, and reuse the saved path for ContentStore publication and Git auto-commit. HTTP update no longer preloads the task; duplicate repair and reorder reuse their local snapshots; cross-worktree/branch ID collision checks remain intact. Board reorder/status responses replace the local task immediately, while the existing WebSocket refresh remains the external-change reconciliation path.

TDD evidence: new scan-count, ambiguity/no-mutation, duplicate-preview, reorder, and rendered React board tests failed on the previous behavior and pass after the change. Focused suites: 157 pass, 0 fail. Full suite: 1785 pass, 4 skip, 0 fail across 199 files. bunx tsc --noEmit, bun run check ., and git diff --check pass. The in-app browser connector was unavailable, so foreground-refresh behavior was verified with the rendered JSDOM/React interaction test.

Ephemeral same-machine fixture (macOS arm64, 20 active + 430 completed, 12-sample medians): status PUT 751.365 -> 123.848 ms (83.5%); duplicate preview 244.863 -> 127.052 ms (48.1%); full App refresh 232.057 -> 116.739 ms (49.7%); reorder endpoint 507.279 -> 125.493 ms (75.3%). Combined board drag + foreground refresh fell from 739.336 ms to 125.493 ms (83.0%) because the redundant foreground refresh was removed. No durable benchmark framework or fixture was added.

Simplification review removed redundant Core ContentStore upsert ownership and retained one persistence helper plus the existing snapshot-aware ID allocator.
<!-- SECTION:NOTES:END -->
