---
id: BACK-627
title: Prevent forced allocation refresh from joining an in-flight stale fetch
status: Done
assignee:
  - '@claude'
created_date: '2026-08-10 06:37'
updated_date: '2026-08-29 18:27'
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
1. In Core.refreshRemoteRefsForTaskRead (src/core/backlog.ts), keep the existing non-forced interval short-circuit and the single-slot remoteRefRefreshPromise join-or-start coalescing unchanged.
2. Before the join-or-start, add a forced-only pre-wait: if a refresh is already in flight when a forced request arrives, await it first. Anything in the slot at that moment started before the request, so its captured refs may predate a push the caller must see.
3. Rely on the slot's existing clear handler (registered synchronously at creation, so it runs ahead of any later awaiter) to empty the slot, which makes the subsequent join-or-start always begin a fetch that starts after the request arrived.
4. Add a regression test in src/test/core-task-corpus-regressions.test.ts: gate a mocked git.fetch so the real fetch captures remote state before a contributor push but withholds resolution, push a task from a clone while that fetch is in flight, then run a concurrent forced generateNextId(); assert it allocates past the pushed task using exactly 2 fetches.
5. Confirm the pre-existing 'allocates past a remote task pushed inside the read refresh window' test still asserts exactly 1 fetch, covering AC #3.
6. Verify the test fails on pre-fix code, then run bunx tsc --noEmit and the full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the reviewer-validated fix: refreshRemoteRefsForTaskRead now captures requestedAt up front and, when forced, loops after joining an in-flight refresh -- if the joined refresh's tracked start time (new remoteRefRefreshStartedAt field) predates requestedAt, it triggers one more fetch instead of returning immediately. Reset remoteRefRefreshStartedAt in disposeContentStore alongside the existing fields.

Added a regression test that gates a mocked git.fetch so the real fetch data-capture happens before a contributor push (to make the race realistic) but resolution is withheld until released, simulating a genuinely in-flight non-forced fetch while the push lands and a forced generateNextId() call joins it. Verified the test fails on pre-fix code (allocates TASK-2, colliding with the pushed task) and passes post-fix (allocates TASK-3, exactly 2 fetches).

Verified: bunx tsc --noEmit clean, bun run check . clean (391 files), full bun run test suite: 2395 pass / 6 pre-existing skips / 0 fail across 250 files (was 2394 pass before the new test).

Addressed Codex PR review (PR #925): replaced the Date.now()-based remoteRefRefreshStartedAt/requestedAt comparison with a monotonic remoteRefRefreshGeneration counter, avoiding a same-millisecond edge case where a stale in-flight fetch could look sufficiently fresh; disposeContentStore no longer resets the counter.

Rebased onto the newly conflict-free BACK-637 branch tip after that branch was rebased onto upstream main; no additional conflicts.

Rebased again (BACK-641) onto BACK-637's new post-BACK-639 tip after that branch was itself rebased onto upstream main -- the previous note here about 'the conflict-free BACK-637 tip' referred to a tip that no longer exists (BACK-637's rebase rewrote every commit SHA). This rebase (via 'git rebase --onto' against the old BACK-637 tip 6753c4d) replayed cleanly with zero conflicts. Verified refreshRemoteRefsForTaskRead and the remoteRefRefreshGeneration field are byte-identical to the pre-rebase version (isolated function-body diff, not just a whole-file diff, since the whole file shifted substantially due to BACK-639's unrelated draft-editing changes). bunx tsc --noEmit clean; the scoped core-task-corpus-regressions.test.ts (7 tests) passes.

Maintainer review (takeover of PR #925): the contributor's diagnosis and fix were correct, and the regression test reproducibly fails on pre-fix code. Two changes on review:

1. Simplified the implementation. The submitted fix tracked fetch ordering with a monotonic remoteRefRefreshGeneration field and re-entered a while(true) loop until the joined fetch's generation exceeded the one captured at entry. That is equivalent to simply waiting out whatever refresh was already in flight: any promise present in the single remoteRefRefreshPromise slot when the request arrives started before the request by construction, and the slot's clear handler is registered at creation, so it runs before any later awaiter's continuation. Replaced the counter and loop with a single guarded pre-wait, dropping one class field and the loop. The loop version also had a latent hazard the linear version does not: if the slot were ever not cleared before the awaiter resumed, it would spin on an already-resolved promise instead of returning.

2. Rebased off the unmerged BACK-637/BACK-641 stack onto origin/main (post BACK-639 draft-editing merge). The PR previously carried the whole BACK-637 project-attribute branch in its diff; replayed the five BACK-627 commits with git rebase --onto and got zero conflicts. The branch now touches only src/core/backlog.ts, src/test/core-task-corpus-regressions.test.ts, and this task file.

Residual race (inherent, not introduced here): a push that lands during the second, post-request fetch is still invisible to that allocation. Closing that would need server-side reservation, not a client fetch.

Residual hole found during maintainer review, deliberately left out of scope (needs a product decision): GitOperations.fetch has its own coalescing layer (this.fetches, keyed by remote, in src/git/operations.ts). Core's forced pre-wait guarantees Core's own remoteRefRefreshPromise slot is empty, and because GitOperations deletes its map entry in a finally before fetch() returns, the forced path does start a genuinely new git fetch in the common case. But generateNextDocId and generateNextDecisionId (src/utils/id-generators.ts) call core.gitOps.fetch() directly, bypassing Core's slot. If one of those is in flight when a forced task-ID refresh runs, Core sees an empty slot, calls git.fetch(), and joins the older git-level fetch -- reintroducing exactly the staleness this task closes. Narrow: it needs a concurrent doc/decision ID allocation in the same process (TUI or web server, not separate CLI invocations). Not fixed here because the obvious fix (a force flag that skips the git-level dedup) can put two concurrent git fetches on the same remote and risk ref lock contention, which is a bigger decision than this task's scope.

Correction to the verification above: the two src/test/core.test.ts failures seen during review ('fails closed when an archive snapshot...' and 'keeps an ID occupied when equal-time branch records...') were not environmental and not caused by this branch. They were a time-bomb in main's own tests -- hardcoded commit dates that aged out of the activeBranchDays window -- and upstream fixed them in main commit 6c6f1843 'Fix expired hardcoded commit dates in core branch-record tests'. Rebased this branch onto that new main; src/test/core.test.ts is now 66 pass / 0 fail locally.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the force-fetch join race in Core.refreshRemoteRefsForTaskRead (src/core/backlog.ts). A forced allocation refresh that arrived while a non-forced fetch was already in flight simply joined that fetch and returned; because that fetch captured remote state before the force request arrived, a push landing during its remaining duration was invisible to allocation and could hand out an already-published numeric ID. The forced path now waits out any refresh that was already in flight before joining or starting one, so the fetch it ultimately observes always starts after the request arrived. Non-forced reads keep the previous join-or-start coalescing, and a forced request with nothing in flight still issues exactly one fetch.

Added a regression test in src/test/core-task-corpus-regressions.test.ts that gates a mocked git.fetch (remote state captured before the push, resolution withheld until released) so a contributor push lands while a non-forced fetch is in flight, then drives a concurrent forced generateNextId(). Verified it fails deterministically on pre-fix code (allocates a colliding TASK-2, reproduced across repeated runs) and passes post-fix (allocates TASK-3 via exactly 2 fetches). The pre-existing single-fetch assertion still holds, covering AC #3.

Verified: bunx tsc --noEmit clean; full bun run test suite green. Note that bun run check . is red on main for an unrelated pre-existing formatting error in src/ui/components/task-composer.ts (untouched by this task).
<!-- SECTION:FINAL_SUMMARY:END -->
