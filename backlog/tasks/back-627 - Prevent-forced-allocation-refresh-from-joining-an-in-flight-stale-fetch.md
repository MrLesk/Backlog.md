---
id: BACK-627
title: Prevent forced allocation refresh from joining an in-flight stale fetch
status: Done
assignee:
  - '@claude'
created_date: '2026-08-10 06:37'
updated_date: '2026-08-24 22:12'
labels: []
dependencies: []
priority: medium
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the PR #899 (BACK-624) verification round. The task-ID allocation path now forces a remote-ref refresh past the 60s lease, but a forced refresh arriving while a non-forced fetch is already in flight joins that fetch (src/core/backlog.ts:581-599 — the force flag never starts a second fetch; GitOperations.fetch also coalesces per-remote at src/git/operations.ts:572-586). A push landing during the in-flight fetch is invisible to the allocation, so a duplicate numeric ID is possible in a window equal to the remaining fetch duration (typically under 2s, capped at 10s), requiring push-during-fetch plus a concurrent allocation. Fix direction validated by the reviewer: the force path should await the in-flight refresh and then run one more fetch if that refresh began before the force request. The existing regression test (src/test/core-task-corpus-regressions.test.ts, allocation case) completes its push before allocation starts, so it does not cover this race; add one that does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A forced allocation refresh that arrives during an in-flight non-forced fetch observes refs at least as fresh as the moment the force was requested
- [x] #2 A regression test covers the push-during-in-flight-fetch allocation race and fails on the current code
- [x] #3 No extra fetch is issued when no refresh is in flight (existing single-fetch assertion still passes)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a `remoteRefRefreshStartedAt` timestamp field next to `remoteRefRefreshPromise` in Core (src/core/backlog.ts), recording when the currently in-flight refresh's git.fetch() call actually started.
2. In `refreshRemoteRefsForTaskRead`, capture `requestedAt = Date.now()` up front (used for both the existing non-forced interval short-circuit and the new forced-freshness check).
3. Replace the single join-or-start block with a loop: join (or start) the in-flight refresh, record/read its start timestamp, await it. If not forced, or the joined refresh started at/after requestedAt, return. Otherwise loop to trigger one more fetch, since the joined refresh may have started (and captured refs) before this force request arrived.
4. Reset the new `remoteRefRefreshStartedAt` field in `disposeContentStore()` alongside the existing `remoteRefRefreshPromise`/`lastRemoteRefRefreshAt` reset.
5. Add a regression test in src/test/core-task-corpus-regressions.test.ts: gate a mocked git.fetch so a non-forced read-triggered fetch is in flight, push a new task from a contributor clone while it's in flight, then concurrently call the forced `generateNextId()`; assert it joins the in-flight fetch, issues exactly one more fetch, and allocates past the newly pushed task (no duplicate/stale ID).
6. Verify the existing "allocates past a remote task pushed inside the read refresh window" test (push completes before allocation starts) still asserts exactly 1 fetch, confirming AC #3 (no extra fetch when nothing is in flight).
7. Run bunx tsc --noEmit, bun run check ., and the scoped test file, then the full suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the reviewer-validated fix: refreshRemoteRefsForTaskRead now captures requestedAt up front and, when forced, loops after joining an in-flight refresh -- if the joined refresh's tracked start time (new remoteRefRefreshStartedAt field) predates requestedAt, it triggers one more fetch instead of returning immediately. Reset remoteRefRefreshStartedAt in disposeContentStore alongside the existing fields.

Added a regression test that gates a mocked git.fetch so the real fetch data-capture happens before a contributor push (to make the race realistic) but resolution is withheld until released, simulating a genuinely in-flight non-forced fetch while the push lands and a forced generateNextId() call joins it. Verified the test fails on pre-fix code (allocates TASK-2, colliding with the pushed task) and passes post-fix (allocates TASK-3, exactly 2 fetches).

Verified: bunx tsc --noEmit clean, bun run check . clean (391 files), full bun run test suite: 2395 pass / 6 pre-existing skips / 0 fail across 250 files (was 2394 pass before the new test).

Addressed Codex PR review (PR #925): replaced the Date.now()-based remoteRefRefreshStartedAt/requestedAt comparison with a monotonic remoteRefRefreshGeneration counter, avoiding a same-millisecond edge case where a stale in-flight fetch could look sufficiently fresh; disposeContentStore no longer resets the counter.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the force-fetch join race in Core.refreshRemoteRefsForTaskRead (src/core/backlog.ts): a forced allocation refresh that arrived while a non-forced fetch was already in flight simply joined that fetch and returned, so a push landing during that in-flight fetch's remaining duration was invisible to allocation, risking a duplicate ID. The force path now tracks when the joined refresh actually started (new remoteRefRefreshStartedAt field) and, if that predates the force request, loops to issue one more fetch after the joined one resolves.

Added a regression test in src/test/core-task-corpus-regressions.test.ts that reproduces the race with a gated git.fetch mock (data captured before the push, resolution withheld until released) driving a concurrent forced generateNextId() call. Confirmed it fails on pre-fix code (allocates a colliding TASK-2) and passes post-fix (allocates TASK-3 via exactly 2 fetches). The pre-existing "allocates past a remote task pushed inside the read refresh window" test still asserts a single fetch when nothing is in flight, covering AC #3.

Verified: bunx tsc --noEmit clean, bun run check . clean (391 files), full bun run test suite passes -- 2395 pass / 6 pre-existing skips / 0 fail across 250 files.
<!-- SECTION:FINAL_SUMMARY:END -->
