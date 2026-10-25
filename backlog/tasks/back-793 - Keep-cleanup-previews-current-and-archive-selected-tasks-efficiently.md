---
id: BACK-793
title: Keep cleanup previews current and archive selected tasks efficiently
status: Done
assignee:
  - '@codex'
created_date: '2026-10-25T19:50:00Z'
updated_date: '2026-10-25T20:10:00Z'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1045'
  - src/web/components/CleanupModal.tsx
  - src/core/backlog.ts
  - src/test/cleanup.test.ts
  - src/test/server-cleanup-endpoint.test.ts
modified_files:
  - src/test/web-cleanup-modal.test.tsx
  - src/web/components/CleanupModal.tsx
  - src/test/cleanup.test.ts
  - src/core/backlog.ts
priority: medium
type: bug
ordinal: 401000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1045 exposes stale cleanup preview/confirmation state. Cleanup also repeatedly reads the full board and archive for each selected task: a disposable 100-task run made 301 reads of each corpus. Refactor the existing preview and archive paths so the displayed selection stays current and batch work avoids repeated corpus reads while preserving review, per-task outcomes, locks and auto-commit behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Only the latest age selection can populate the cleanup preview and confirmation; closed or reopened dialogs ignore earlier responses.
- [x] #2 The archive action sends exactly the IDs in the current displayed preview and cannot submit stale or loading state.
- [x] #3 A normal cleanup batch reads the task corpus a bounded number of times instead of once per selected task.
- [x] #4 Cleanup rechecks final status and identity under the existing locks, skips changed tasks, and retains per-task failure handling when one task is busy or cannot be archived.
- [x] #5 CLI and browser cleanup share archive behavior and preserve existing commit and read-only semantics.
- [x] #6 Deferred-response DOM tests, HTTP/core regressions and a before/after benchmark verify the flow.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add deferred-response UI tests for changing age, stale confirmations and reopening the dialog. Keep each displayed preview tied to its selected age and invalidate old requests.
2. Add core regressions for bounded corpus reads, locked tasks and tasks reopened before archive locks. Share the existing file-move/commit implementation and validate the selected batch under locks.
3. Run focused UI/core/HTTP and lifecycle checks, types, formatting, build, and the disposable before/after benchmark. Verify cleanup in a disposable browser project.
4. Simplify the final implementation, create its scoped PR, run independent Codex and maintenance reviews, then merge after all CI checks pass.

5. Address independent review findings: retain cross-branch identity checks in the batch snapshot, refresh fallback targets before locking, and add combined concurrency/alias regressions. Repeat correctness and junior-maintenance reviews on the updated commit.

6. Cover a task disappearing during the initial metadata read and retry that snapshot only for transient missing-file races, with a fixed retry limit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a single cleanup selection state carrying age and task IDs through loading, preview, confirmation and execution. Request generations invalidate late responses on selection changes, close, reopen and unmount. Execution is guarded synchronously and modal closing is disabled while archiving.
Shared the existing archive file move, content-store transition and scoped commit implementation. Cleanup acquires selected task locks before the allocator lock, refreshes identity once inside those locks, rechecks terminal status, and reports outcomes per task. If the batch cannot acquire all locks before writing, it falls back to per-task locked checks so an unrelated busy task does not stop the rest. It never retries a started batch.
Regression evidence: four UI cases failed before the change; the new corpus-read and reopened-under-lock cases also failed before the change. Added identity-change, ID-alias, busy-task and failed-commit coverage. 76 distinct focused tests pass across cleanup, HTTP/UI, archive folders, CLI input and commit scoping. Types, Biome checks, TSX formatting and build pass.
Disposable benchmark: 25 tasks fell from 76 board/archive reads and about 87 ms to 2/2 reads and 20 ms; 100 tasks fell from 301/301 reads and about 823 ms to 2/2 reads and 63 ms. Timings are local measurements, not guarantees.
Browser interaction was attempted through the Browser skill, but its runtime failed during import with: Importing module node:process is not allowed in node_repl. No live browser result is claimed; DOM and live HTTP tests cover the flow.
Simplicity pass: age and preview count are derived from one selection, no global cache or new service, and both archive entry points share one file-move/commit helper.

Independent Codex correctness and junior-maintenance reviews found two regressions in the initial refactor: branch identities were omitted and fallback targets could use stale paths. Added three real filesystem/Git regressions that failed first, then switched the batch to the existing stable branch-aware corpus loader. Each fallback target is refreshed before locking and checked again if it disappears during acquisition. Identity and terminal status remain checked inside the locks.
All 79 distinct focused tests now pass (60 core/archive/CLI/commit tests plus 19 HTTP/UI tests), along with types, Biome and build. The corrected benchmark remains bounded: 25 tasks use 2/2 reads in 21 ms; 100 use 2/2 in 64 ms locally. The maintenance review found the phase-state modal and shared archive helper reasonable; its concrete findings are addressed without adding a new layer.

A second independent correctness review reproduced an unselected task disappearing between enumeration and metadata stats, which could abort the entire initial snapshot. Two real filesystem regressions (selected and unselected moved tasks) failed first. The existing cleanup-local snapshot loader now retries ENOENT at most three times, preserving all other errors. A further test verifies the retry limit. All 47 cleanup/UI/HTTP tests pass; together with the 35 archive/CLI/commit tests this gives 82 distinct focused passing tests. Types, Biome and build pass. The small retry loop keeps its limit and reason beside the code rather than introducing another abstraction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cleanup now invalidates stale selections and confirmations, submits only the confirmed preview IDs once, and archives normal batches with two corpus reads under the existing locks. Reopened or ambiguous tasks are refused safely, busy tasks do not block others, and archive commit behavior is shared. Focused regressions, types, formatting, build and benchmark pass; live browser interaction is limited by the browser runtime import failure.
<!-- SECTION:FINAL_SUMMARY:END -->
