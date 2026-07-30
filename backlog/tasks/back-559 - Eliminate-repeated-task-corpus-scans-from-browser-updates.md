---
id: BACK-559
title: Eliminate repeated task-corpus scans from browser updates
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:12'
updated_date: '2026-07-30 18:33'
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
  - src/test/server-reorder-publication.test.ts
  - src/test/web-board-filters.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
type: bug
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser task mutations repeatedly parse the complete active and completed task corpus. With 20 active and 430 completed tasks, a status update regressed from roughly 3 ms in v1.47.0 to roughly 607 ms on current main, while duplicate repair preview adds about 202 ms and the board can request a second refresh. Resolve task identity once per mutation, reuse one active/completed snapshot for duplicate repair, and avoid redundant board refresh work while preserving fail-closed identity behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One ordinary browser task status update performs at most one active/completed identity scan, persists the change, and returns the updated task.
- [x] #2 Duplicate repair preview loads active and completed tasks once and reuses that snapshot for duplicate detection, existing-ID allocation input, and fingerprint preparation.
- [x] #3 One board drag applies the returned task immediately and does not cause two duplicate-plan builds; the existing WebSocket refresh still reconciles external changes.
- [x] #4 Fail-closed behavior remains for active/active, active/completed, zero-padded, cross-prefix, and filename/frontmatter ID collisions, and ambiguous mutations alter no file.
- [x] #5 Completed tasks remain excluded from the active board, and current auto-commit, Git staging and commit, updated-date, and status callback behavior remains unchanged.
- [x] #6 An ephemeral same-machine fixture with 20 active and 430 completed tasks records before and after status-update, duplicate-preview, and drag-path measurements with at least a 70 percent reduction in the combined mutation and refresh median; no durable benchmark framework is added.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused regression tests first: count active/completed corpus loads for one HTTP task mutation and one duplicate preview; assert ambiguous active/active, active/completed, zero-padded, cross-prefix, and filename/frontmatter mutations remain fail-closed without file changes; assert a board reorder applies the returned task without invoking a foreground refresh. Baseline on the 20-active/430-completed fixture: status PUT median 607.8 ms, duplicate preview 201.7 ms, full refresh 202.5 ms on current main.
2. Collapse task persistence around the already-resolved original task: remove the server pre-read, preserve the one FileSystem identity scan, pass the original into a private persistence path, use the save result for ContentStore/Git, and return the updated task without reloading the corpus. Reuse one active/completed snapshot throughout duplicate detection and local repair-ID allocation.
3. Apply the reorder response to App task state immediately and leave the existing WebSocket refresh as reconciliation. Run focused server/collision/Web tests, type-check, Biome, broader relevant tests, an ephemeral same-machine 20/430 before/after measurement, rendered-browser validation where available, simplification review, and final scoped diff inspection.

4. Review-and-fix cycle one: reproduce the live multi-task reorder WebSocket fan-out and delayed-response race with real-path regressions. Batch only reorder-triggered server publications into one reconciliation, and publish mutation responses only while the task still has the object identity captured when the request began. Preserve immediate response application when no reconciliation won, then rerun collision/server/WebSocket/Board coverage and the end-to-end fixture including the surviving reconciliation.

5. Final review cycle: reproduce the disconnected-WebSocket rebalance gap, return Core changedTasks through the existing reorder response, apply every returned task through the request-object stale guard without a foreground refresh or extra corpus scan, and cover the server plus rendered App boundaries before rerunning the benchmark and full verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the browser mutation fast path around one resolved task identity and one reusable active/completed snapshot. Core task updates now persist the resolved task directly, exact-parse only the saved file for normalized response data, and reuse the saved path for ContentStore publication and Git auto-commit. HTTP update no longer preloads the task; duplicate repair and reorder reuse their local snapshots; cross-worktree/branch ID collision checks remain intact. Board reorder/status responses replace the local task immediately, while the existing WebSocket refresh remains the external-change reconciliation path.

TDD evidence: new scan-count, ambiguity/no-mutation, duplicate-preview, reorder, and rendered React board tests failed on the previous behavior and pass after the change. Focused suites: 157 pass, 0 fail. Full suite: 1785 pass, 4 skip, 0 fail across 199 files. bunx tsc --noEmit, bun run check ., and git diff --check pass. The in-app browser connector was unavailable, so foreground-refresh behavior was verified with the rendered JSDOM/React interaction test.

Ephemeral same-machine fixture (macOS arm64, 20 active + 430 completed, 12-sample medians): status PUT 751.365 -> 123.848 ms (83.5%); duplicate preview 244.863 -> 127.052 ms (48.1%); full App refresh 232.057 -> 116.739 ms (49.7%); reorder endpoint 507.279 -> 125.493 ms (75.3%). Combined board drag + foreground refresh fell from 739.336 ms to 125.493 ms (83.0%) because the redundant foreground refresh was removed. No durable benchmark framework or fixture was added.

Simplification review removed redundant Core ContentStore upsert ownership and retained one persistence helper plus the existing snapshot-aware ID allocator.

Review cycle one red probes on commit 79103a01: a live server/WebSocket test observed two tasks-updated messages for a two-task ordinal rebalance (expected one), and a rendered App test showed a delayed reorder response replacing a newer WebSocket-reconciled external edit. Root causes are per-task ContentStore events forwarded during reorder and mutation responses applied without guarding the request-start task identity.

Review cycle one disposition: fixed both Important findings without changing persistence, ContentStore publication, collision checks, callbacks, or WebSocket external reconciliation. BacklogServer now defers ContentStore task broadcasts only while a reorder request is active and flushes exactly one tasks-updated message, including on partial-failure exit. Board captures the task object at request start; App applies the response only if reconciliation has not replaced that object. A separate full-App regression confirms uninterrupted responses still update the board immediately.

Verification for the correction: the two new real-path tests were observed failing on 79103a01 (two WebSocket publications; stale response overwrote the external edit) and pass after the fix. Focused server/WebSocket/Board/collision/ContentStore/watcher suite: 179 pass, 0 fail. Post-simplification Web tests: 36 pass, 0 fail. Full suite: 1788 pass, 4 skip, 0 fail across 200 files. bunx tsc --noEmit, bun run check . (340 files), and git diff --check pass.

Revised ephemeral benchmark uses fresh same-machine macOS arm64 Git fixture copies with 20 active and 430 completed tasks, forces a two-task ordinal rebalance for every sample, and defines completion as both the mutation response and all surviving App refresh requests (statuses, config, search, milestones, archived milestones, and duplicate preview). Across 12-sample medians, current main actual sequential mutation + foreground refresh is 1308.412 ms (p95 1701.177); corrected branch with one WebSocket reconciliation is 230.886 ms (p95 269.255), an 82.4% reduction. Versus pre-review 79103a01 specifically, two WebSocket reconciliations took 319.125 ms (p95 410.763), so coalescing to one reduces this corrected-path median another 27.6%. No benchmark artifact was added.

Independent final review at e6e56ee9544d4c1de71dc016b88f0418f25356f1 declared READY with no Critical or Important findings.

Automatic Codex review on PR #828 at commit 343260f06a2d1cc1466c716ba59acf16879576b1 found one P2: a forced ordinal rebalance persists sibling tasks but the browser response applies only the moved task, so a disconnected WebSocket leaves sibling ordinals stale. Reproduction with TASK-1, TASK-2, and TASK-3 all at ordinal 1000 returned only TASK-3 at 2000 while disk also persisted TASK-2 at 3000. Root cause is the HTTP handler discarding Core changedTasks; the TUI already applies changedTasks plus updatedTask.

Final review cycle TDD: the real server regression first failed because changedTasks was absent, and the rendered full-App regression with a closed data WebSocket first failed because the moved task rendered ahead of its stale sibling. The server now returns Core changedTasks alongside the existing task field; ApiClient types the complete response; Board applies updatedTask plus every changed task through the request-start object guard. No foreground refresh, corpus load, persistence operation, or WebSocket reconnect layer was added. Focused server and rendered Web suite: 37 pass, 0 fail. Full suite: 1789 pass, 4 interactive skips, 0 fail, 7590 expectations across 200 files in 228.62 seconds. bunx tsc --noEmit, bun run check . across 340 files, and git diff --check pass.

Fresh ephemeral benchmark after the final correction used alternating same-machine macOS arm64 Git fixture copies with 20 active and 430 completed tasks and 12 measured samples per variant. Every sample forced the same two-task ordinal rebalance. Completion included the mutation response and every surviving App refresh request: statuses, config, search, milestones, archived milestones, and duplicate preview. Current origin/main fef6e763d9300ab6ba4d123c5555d2db55b6914e included its foreground refresh plus both WebSocket reconciliations and measured 1285.543 ms median, 1366.933 ms p95. The corrected path returned both changed tasks and used one WebSocket reconciliation, measuring 108.588 ms median, 241.318 ms p95, a 91.6 percent median reduction. No benchmark artifact or framework was retained.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Eliminated repeated task-corpus scans from browser updates by persisting resolved identities, reusing task snapshots, coalescing reorder reconciliation, and rejecting stale mutation responses. Reorder responses now carry every persisted changed task through the existing stale-response guard, so forced two-task rebalances remain correct when WebSocket delivery is unavailable while the connected path still uses one reconciliation. Preserved fail-closed collision handling, ContentStore and Git semantics, callbacks, completed-task filtering, and external WebSocket reconciliation. Verified by 1,789 passing tests with 4 interactive skips, 37 focused server and rendered-App passes, TypeScript and Biome checks, and a fresh 20-active and 430-completed benchmark. End-to-end completion including the mutation response plus every surviving refresh improved from 1,285.543 ms to 108.588 ms median, a 91.6 percent reduction.
<!-- SECTION:FINAL_SUMMARY:END -->
