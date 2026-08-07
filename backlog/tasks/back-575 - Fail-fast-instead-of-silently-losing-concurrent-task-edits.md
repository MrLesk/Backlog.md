---
id: BACK-575
title: Fail fast instead of silently losing concurrent task edits
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 17:53'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/843'
priority: high
type: bug
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #843. `updateTaskFromInput` (src/core/backlog.ts:2025-2046) is an unlocked read-modify-write that serves CLI `task edit`, the MCP `update_task` tool, and the web PUT handler (src/server/index.ts:1048). Two concurrent edits of the same task silently lose one write while both callers report success. Silent data loss is the worst possible outcome for a tool whose whole value is a reviewable, trustworthy record of work.

Maintainer decision (confirmed): use filesystem-level locking that protects across separate backlog processes, and on contention FAIL FAST with a clear error such as "Edit failed: TASK-X is being modified by another process; retry if appropriate". No waiting, no re-read-and-merge, no automatic retry - the caller decides what to do. The web surface must return HTTP 409 and MCP must surface an appropriate operation error.

Reference material: withdrawn PR #852 from iRonin (fork branch fix/task-edit-locking, commit 7bbf033) contains reusable lock plumbing (a withTaskLock helper alongside the existing withCreateLock in src/file-system/operations.ts) and a strong concurrency test harness (src/test/atomic-task-edit.test.ts and scripts/smoke-parallel-task-locking.sh). Its wait-and-re-read semantics do NOT match the decided fail-fast behavior - reuse the plumbing and the harness, not the semantics. Credit the report from iRonin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Concurrent edits of the same task never silently lose data: one edit succeeds and the other fails
- [ ] #2 The locking protects across separate backlog processes, not only within a single process
- [ ] #3 A losing CLI edit exits non-zero with a clear message naming the task and the contention
- [ ] #4 The web update endpoint returns HTTP 409 on contention
- [ ] #5 The MCP update_task tool returns an appropriate operation error on contention
- [ ] #6 No waiting, merging, or automatic retry happens on contention
- [ ] #7 A concurrency test proves lost-update protection
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/file-system/operations.ts: extract the shared proper-lockfile mechanics of withCreateLock into a private withLockTarget(target, lockDir, settings, toError, fn) and add FileSystem.withTaskLock(task, fn) beside it. The task lock is FAIL FAST (retries: 0), reuses the same lock directory resolution (git common dir, else backlog/.locks) and the USE_GLOBAL_TASK_ID_LOCK=false escape hatch, and targets the task file itself (proper-lockfile keys its in-process registry by target path, so a shared target with per-task lockfilePaths corrupts concurrent in-process locks). Add ETASKLOCK / isTaskLockError / taskLockErrorMessage(taskId) producing 'Edit failed: <id> is being modified by another process; retry if appropriate.'
2. src/core/backlog.ts: wrap the read-modify-write in updateTaskFromInput with fs.withTaskLock and re-read the task inside the lock. The re-read is required for correctness, not merging: a lock around the write alone still loses an update when writer A releases before writer B acquires, because B would then apply its mutation to a pre-lock snapshot.
3. Surface the contention error: web PUT /api/tasks/:id returns 409 (extend the isCreateLockError mapping in src/server/index.ts), MCP task_edit throws BacklogToolError OPERATION_FAILED (src/mcp/tools/tasks/handlers.ts editTask), CLI needs no change (formatTaskEditError already prints error.message and sets exit code 1) - add a test to lock that in.
4. Tests: new src/test/atomic-task-edit.test.ts adapted from iRonin's harness to fail-fast semantics - N concurrent same-task edits, assert at least one success, every failure is a task-lock error naming the task, and the final file contains exactly the successful writers' labels and nothing else; concurrent edits of different tasks stay independent; escape hatch bypasses the lock. Plus a cross-process proof (real CLI subprocesses) since AC #2 is about separate processes.
5. scripts/smoke-parallel-task-locking.sh: add scenario 4, parallel 'task edit' from separate CLI processes over a board pre-filled with filler tasks to widen the race window; assert every job either exits 0 or fails loudly with the contention message, and that the final file content matches exactly the jobs that exited 0.
6. Verify: bunx tsc --noEmit, bun run check ., new + existing lock/edit tests, full bun test, and the smoke script.
Out of scope (follow-ups): reorderTask/updateTasksBulk, draft edits (updateDraftFromInput), and the TUI external-editor write path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Design

Added `FileSystem.withTaskLock(task, fn)` in src/file-system/operations.ts beside the existing `withCreateLock`; both now share one proper-lockfile implementation (`withLockTarget`), and the two lock-error constructors/guards share `lockError`/`isLockError`.

The task lock is **fail fast**: proper-lockfile is configured with `retries: 0`, so a contended edit raises immediately. `isTaskLockError` identifies it and `taskLockErrorMessage(id)` is the single source of the copy: 'Edit failed: <id> is being modified by another process; retry if appropriate.' Nothing waits, merges, or retries - the caller decides. Stale locks still recover after the shared 10s threshold (proper-lockfile refreshes the mtime while an edit is in flight, so a slow edit never goes stale), so a crashed process cannot wedge a task.

`Core.updateTaskFromInput` (the single funnel for CLI `task edit`, MCP `task_edit` via `editTaskOrDraft`, and the web PUT) now runs its read-modify-write inside that lock. **The snapshot is re-read inside the lock, and that is required for correctness, not merging**: a lock around only the write still loses an update whenever one writer releases before the next acquires, because the second would apply its changes to a snapshot taken before the first wrote.

Two deliberate departures from the reference material in withdrawn PR #852:
- **Lock location.** The lockfile lives under this project's backlog directory (`backlog/.locks/task-<id>`), not the shared git common dir the create lock uses. An edit protects one file, so sibling worktrees editing their own copy of a task must not fail each other - with fail-fast semantics a false conflict is a real failure, not just a wait. It also drops a `git rev-parse` spawn from every edit. The lock target is still the task file itself, because proper-lockfile keys its in-process lock registry by target path and a shared target would corrupt concurrent in-process locks (ERELEASED).
- **Semantics.** #852 waited on the lock and re-read; this fails fast per the confirmed product decision.

## Error surfaces

- CLI: no code change needed - `formatTaskEditError` already prints `error.message` and sets exit code 1. Covered by a test so it stays that way.
- Web: `handleUpdateTask` maps the lock error to **HTTP 409** next to the existing ambiguous-id 409.
- MCP: `TaskHandlers.editTask` maps it to `BacklogToolError(..., "OPERATION_FAILED")`, matching the `isCreateLockError` precedent, rather than the VALIDATION_ERROR fallback.
- MCP milestone bulk operations already catch `editTask` failures and roll back, so they surface it loudly without change.

## Tests

New src/test/atomic-task-edit.test.ts (7 tests) - harness shape adapted from iRonin's PR #852, expectations changed from 'all six succeed' to fail-fast:
1. six concurrent in-process edits: at least one succeeds, every failure is a task-lock error with the exact message, and **the final file's labels equal exactly the writers that were told they succeeded**;
2. concurrent edits of different tasks stay independent;
3. cross-process: with the lock held in-process, a real `bun src/cli.ts task edit` subprocess exits non-zero with the message, leaves the file untouched, and succeeds on retry once released;
4. six parallel CLI subprocesses over a 40-task board: >=1 exit 0, every non-zero exit prints the contention message, final content matches exactly the exit-0 jobs;
5. web PUT returns 409 with the message while the lock is held;
6. MCP editTask throws OPERATION_FAILED with the message;
7. USE_GLOBAL_TASK_ID_LOCK=false still bypasses the lock.

scripts/smoke-parallel-task-locking.sh gains scenario 4 (8 parallel CLI edits over a 100-task board, which widens the read window enough for the processes to really overlap); it classifies jobs instead of requiring success and asserts the final file names exactly the winners.

## Evidence

- Regression value verified by reverting only the core change: 5 of the 7 new tests fail, and smoke scenario 4 fails with 8/8 jobs exiting 0 but only `smoke-6` surviving in the file - 7 writes silently lost. With the fix, the same smoke run reports 8 jobs / 1 succeeded and matching content.
- Observed cross-process run: 1 winner, 5 losers each printing 'Edit failed: TASK-41 is being modified by another process; retry if appropriate.', file contains exactly the winner's label.
- `bunx tsc --noEmit` clean; Biome clean (`bunx biome check src scripts *.json` - note `bun run check .` processes 0 files inside a .claude worktree because biome.json excludes `**/.claude`); `bun test` 1896 pass / 5 skip / 0 fail; smoke script all four scenarios pass.

## Known follow-ups (deliberately out of scope)

- `reorderTask` / `updateTasksBulk` (board drag, archive link sanitiser) - multi-file write, needs its own locking story.
- Draft edits (`updateDraftFromInput` -> `saveDraft`) are still unlocked.
- The TUI external-editor write path - a lock would have to span an interactive editor session.
- An edit holds the lock across auto-commit and any `onStatusChange` callback, so a slow callback makes concurrent edits of that same task fail fast.

Credit: the defect report, the measurement of the lost-write window, and the shape of the concurrency harness come from iRonin (withdrawn PR #852, issue #843).
<!-- SECTION:NOTES:END -->
