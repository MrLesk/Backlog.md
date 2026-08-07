---
id: BACK-575
title: Fail fast instead of silently losing concurrent task edits
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 18:50'
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
- [x] #1 Concurrent edits of the same task never silently lose data: one edit succeeds and the other fails
- [x] #2 The locking protects across separate backlog processes, not only within a single process
- [x] #3 A losing CLI edit exits non-zero with a clear message naming the task and the contention
- [x] #4 The web update endpoint returns HTTP 409 on contention
- [x] #5 The MCP update_task tool returns an appropriate operation error on contention
- [x] #6 No waiting, merging, or automatic retry happens on contention
- [x] #7 A concurrency test proves lost-update protection
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

## Review fix: Draft demotion was outside the lock (F1)

The Draft-status branch routed to `demoteTaskWithUpdates` before the lock was taken, leaving its whole read-modify-write (apply input to a pre-lock snapshot, save draft, unlink the task file) unprotected. Reachable from the web PUT and MCP `task_edit` (its status enum includes "Draft"); plain CLI `task edit` rejects "Draft" and was never exposed.

Fix: the task lock now lives **inside `demoteTaskWithUpdates`**, with the same in-lock re-read. That placement was chosen over wrapping the branch in `updateTaskFromInput` because `editTaskOrDraft` (the MCP path) calls `demoteTaskWithUpdates` **directly**, bypassing `updateTaskFromInput` entirely - locking at the demote closes both entry points with one lock site and no nesting. `updateTaskFromInput` still delegates to it before taking its own lock, so the locks never nest.

**Deadlock check (verified, not assumed):** inside the task lock the demote waits on the create lock, so the order is task lock then create lock. All six `withCreateLock` bodies were read - `createTaskFromInput`, `promoteDraftWithUpdates`, `demoteTaskWithUpdates`, `promoteDraft`, `createDocumentFromInput`, and `applyDuplicateTaskIdRepair` - and none of them acquires a task lock or calls the edit funnel (`grep` for editTask/updateTask/withTaskLock in duplicate-task-repair.ts is empty). The order is acyclic. Even a future cycle would surface as an immediate fail-fast error rather than a hang, because the task lock never retries.

Also fixed (F4, advisory): ENOENT while acquiring the lock - the task file moved or was removed between snapshot load and lock acquisition - now maps to 'Edit failed: <id> was moved or removed by another process.' instead of a raw errno, and therefore to 409 / OPERATION_FAILED like other contention.

Two new tests (9 total in the file):
- **the demote race**: the create lock is held so the demote parks inside its draft-id allocation, then a concurrent edit runs; the invariant asserted is that either the edit fails loudly with the contention message and the draft does not carry its label, or the edit succeeded and the draft does carry it - never a success report with a lost write. Verified as a genuine regression test: with the lock removed from the demote it fails with exactly the reported symptom - the edit resolved successfully and the demoted draft came back with `[]`.
- **the MCP entry point**: with the task lock held, `editTaskOrDraft(id, { status: "Draft" })` now rejects with the contention message, the task file survives, and no draft is created. Confirmed by probe that this path was previously unprotected even after the first fix.

Re-verified after the fix: `bunx tsc --noEmit` clean, Biome clean, `bun test` 1898 pass / 5 skip / 0 fail, smoke script all four scenarios pass (8 jobs, 1 succeeded).

Still out of scope and unchanged as declared follow-ups: draft edits (`updateDraftFromInput`), board reorder / `updateTasksBulk`, and the TUI external-editor write path. Plain `backlog task demote` (`Core.demoteTask`) is a separate path and remains unprotected.

**F3, recorded as a known behavioral consequence:** the lock is held across auto-commit and the `onStatusChange` callback, so a callback that itself edits the same task will always fail with the contention message, and any slow callback makes concurrent edits of that task fail fast for its duration.

## Acceptance criteria evidence

All checks below were re-run on the rebased branch (onto origin/main @ 3b3bddc9).

- **AC #1 (no silent data loss)** - two tests, because there are two read-modify-write shapes in the funnel. `src/test/atomic-task-edit.test.ts` 'never silently loses a concurrent edit: winners land, losers fail loudly' asserts the file's labels equal **exactly** the writers that were told they succeeded across six concurrent edits; 'never silently loses an edit that races a demotion to Draft' covers the Draft branch found in review, asserting the racing edit either fails loudly and leaves no trace in the draft, or succeeded and survives in it. Both were confirmed to fail on the unfixed code (six-writer: content mismatch; demote race: edit resolved successfully while the draft came back empty).
- **AC #2 (across separate processes)** - 'blocks a second process while the first holds the lock' holds the lock in-process and runs a real `bun src/cli.ts task edit` subprocess; plus smoke scenario 4 with 8 independent CLI processes.
- **AC #3 (CLI exits non-zero, clear message)** - same test asserts a non-zero exit and the exact message on stderr, then a successful retry once released. Observed run: 5 losers each printed 'Edit failed: TASK-41 is being modified by another process; retry if appropriate.'
- **AC #4 (web 409)** - 'returns HTTP 409 from the web update endpoint on contention' starts a real BacklogServer and asserts status 409 plus the message body.
- **AC #5 (MCP operation error)** - 'reports an MCP operation error on contention' asserts `OPERATION_FAILED` with the message; 'blocks a demotion to Draft that reaches the funnel through editTaskOrDraft' covers the second MCP entry point.
- **AC #6 (no waiting, merging, or retry)** - proper-lockfile is configured with `retries: 0`; the contended CLI subprocess returns immediately rather than after a timeout, and every loser in the six-writer race fails rather than merging. The in-lock re-read is not a merge: it makes the critical section cover the read, and 'keeps concurrent edits of different tasks independent' shows unrelated tasks never serialize.
- **AC #7 (concurrency test)** - the 9-test suite plus smoke scenario 4, both demonstrated to fail on the unfixed code.

Definition of Done: `bunx tsc --noEmit` clean; `bun run check .` clean (358 files - this now works inside agent worktrees thanks to 1034279f on main, which anchors the biome `.claude` exclusion to the project root, so the caveat recorded earlier no longer applies); `bun test` 1906 pass / 5 skip / 0 fail; smoke script all four scenarios pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the silent-lost-update hole in the task edit funnel by adding a fail-fast, filesystem-level per-task lock.

`FileSystem.withTaskLock` sits beside the existing `withCreateLock` and shares its proper-lockfile mechanics, but is configured with `retries: 0`: on contention the loser gets 'Edit failed: <id> is being modified by another process; retry if appropriate' immediately. Nothing waits, merges, or retries - the caller decides. `Core.updateTaskFromInput` and `demoteTaskWithUpdates` now run their read-modify-write inside that lock, re-reading the task inside it so the critical section covers the read; a lock around the write alone would still lose an update whenever one writer released before the next acquired. Locking the demote itself (rather than the Draft branch of updateTaskFromInput) is what closes the funnel, because MCP's editTaskOrDraft calls it directly. The lockfile lives under the project's backlog directory rather than the shared git common dir, so sibling worktrees editing their own copy of a task cannot fail each other. CLI exits non-zero with the message, the web PUT returns 409, MCP reports OPERATION_FAILED.

Verified with a 9-test concurrency suite (src/test/atomic-task-edit.test.ts) and a new smoke scenario: six concurrent edits leave the file matching exactly the writers told they succeeded; a real CLI subprocess is blocked by a lock held in another process and succeeds on retry; the Draft demotion race and both MCP entry points are covered. Regression value proved by reverting each fix - the six-writer test fails on content mismatch, the demote-race test reproduces the reported symptom (edit resolves successfully, draft comes back empty), and smoke scenario 4 shows 8/8 jobs exiting 0 with 7 writes silently lost. bunx tsc --noEmit clean, bun run check . clean, bun test 1906 pass / 5 skip / 0 fail, smoke script all four scenarios pass.

Defect report, lost-write measurement, and concurrency-harness shape credited to iRonin (issue #843, withdrawn PR #852). Declared follow-ups, deliberately out of scope: draft edits (updateDraftFromInput), reorderTask/updateTasksBulk, the TUI external-editor write path, and plain `backlog task demote`.
<!-- SECTION:FINAL_SUMMARY:END -->
