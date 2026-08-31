---
id: BACK-663
title: Dependency graph follow-ups from BACK-548 review
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-30 19:38'
updated_date: '2026-08-31 20:56'
labels:
  - cli
  - tui
  - web
  - enhancement
dependencies: []
ordinal: 295000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Low-severity findings deferred from the PR #960 review triage, none affecting supported flows today: (1) formatter indentation builds a growing prefix per depth (dependency-graph-text.ts appendTreeLines) — cap or iterate for pathological depths; (2) BFS uses queue.shift() — cursor micro-optimization; (3) the filtered TUI viewer collapses duplicate canonical IDs where the CLI fails closed (task-viewer-with-search.ts resolveDependencyCorpus) — align on fail-closed; (4) cross-branch completed dependencies render missing in the web graph (store getTasks excludes completed records; only local completed joins the corpus); (5) the filtered TUI readiness snapshot goes stale on out-of-view external changes until reopen; (6) after graph-link navigation the web sync ref compares dependency lists across different task IDs and triggers one redundant fetch (App.tsx sync effect — require matching IDs); (7) another client editing a different task leaves an open modal dependents list stale until reopen. Self-dependency creation is BACK-656, drafts-in-corpus policy is BACK-601, MCP corpus alignment is BACK-625.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each listed item is fixed or explicitly closed as accepted behavior with a note
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Formatter: make appendTreeEntries iterative (explicit stack) so pathological depths cannot exhaust the call stack (dependency-graph-text.ts)
2. Graph BFS: replace queue.shift() with a cursor index in buildDependencyGraph traverse and findCycleThroughRoot (dependency-graph.ts)
3. TUI corpus: merge readiness snapshot with live display copies by file identity instead of canonical ID so duplicate identities reach createTaskRecordIndex and fail closed as ambiguous, matching the CLI (task-viewer-with-search.ts resolveDependencyCorpus)
4. Web corpus: in loadTaskCorpus cross-branch path, add identity-index completed records the local completed corpus does not already hold, so cross-branch completed dependencies resolve as completed instead of missing (task-detail.ts)
5. TUI readiness staleness on out-of-view external changes: assess; likely accept with note (local TUI reads the working copy at open)
6. Web sync effect: require matching task IDs before comparing dependency lists so graph-link navigation stops triggering a redundant fetch (App.tsx)
7. Open modal dependents staleness from other clients: assess; likely accept with note (no new subscription machinery)
8. Focused tests for 1-4 and 6 where testable; run tsc, biome, full test suite
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Disposition per review item:

1. FIXED - Growing string prefix / recursion in the tree render. appendTreeEntries (src/formatters/dependency-graph-text.ts) and buildDependencyTree (src/utils/dependency-graph.ts) now walk depth-first with explicit stacks, so a pathological dependency chain cannot exhaust the call stack anywhere on the render path. The per-level prefix segment stays: it is the indentation the rendered lines themselves carry, so its cost is proportional to the output. Verified by a 2500-deep chain test asserting line count and deepest-line indentation.

2. FIXED - queue.shift() BFS. Both breadth-first walks (traverse in buildDependencyGraph and findCycleThroughRoot) now advance a cursor index over the queue array instead of shifting, removing the quadratic dequeue. Behavior covered by the existing graph tests plus the new deep-chain test.

3. FIXED - Filtered TUI corpus collapsed duplicate canonical IDs. The snapshot/live merge (now mergeDependencyCorpusTasks in src/ui/task-viewer-with-search.ts) merges claimant groups instead of single records per canonical ID: a uniquely claimed identity is still overlaid by its live display copy (in-session status edits keep counting, and a title rename does not fork the record because the overlay is by identity), while an identity claimed by more than one record keeps every claimant so createTaskRecordIndex reports it ambiguous - the same fail-closed answer the CLI gives. Test drives the merged corpus through the shared graph and asserts the ambiguous node state.

4. FIXED - Cross-branch completed dependencies rendered as missing in the web graph. loadTaskCorpus (src/core/task-detail.ts, cross-branch path only) now adds the identity index's completed records (TaskIdentityIndex.getTasks(true), source === 'completed') that the local completed corpus does not already hold. Identities with any active record anywhere still resolve to that record (the index's lifecycle selection prefers active over completed), so exactly one record per identity joins the corpus. Regression test: a dependency existing only as a completed record on another branch now resolves as completed instead of missing; verified the test fails without the fix.

5. ACCEPTED AS BEHAVIOR - Filtered TUI readiness snapshot staleness on out-of-view external changes. The unified view already watches the working copy's tasks directory and upserts changed or added records into the live list, which the merge from item 3 lets win over the snapshot - so most external edits do reach readiness while the view is open. The residual staleness (a deleted out-of-view record lingering, or changes the watcher cannot attribute) lasts only until the view reopens and matches the CLI's read-at-invocation posture. A second subscription dedicated to the snapshot would duplicate the existing watcher for a marginal window; not worth the machinery.

6. FIXED - Redundant fetch after graph-link navigation. The App.tsx modal sync effect now requires previousRecord.id === updatedTask.id before comparing dependency lists, so navigating between tasks no longer reads two different tasks' lists as an edit. Test opens a task by route, follows a dependency-graph link, and asserts exactly one /api/task fetch for the target; verified the test fails without the guard.

7. ACCEPTED AS BEHAVIOR - Open modal dependents list staleness when another client edits a different task. The modal refetches its detail when the open task's own dependencies change (item 6 keeps that precise); refreshing on every corpus broadcast while a modal is open would cost one detail request per external change for a display-only list that corrects on reopen or on any edit to the open task. Under the no-new-subscription-machinery and simplicity-first rules this stays as designed.

Validation: bunx tsc --noEmit clean, bun run check . clean, bun run test full suite 2811 pass / 0 fail.

Final Summary:
--------------------------------------------------
Dispositioned all seven PR #960 follow-ups: fixed items 1-4 and 6 (iterative tree walks in the formatter and tree builder, cursor-based BFS, fail-closed claimant-group merge for the filtered TUI corpus, cross-branch completed records joining the web graph corpus, and a matching-task-ID guard before the web modal sync compares dependency lists), and closed items 5 and 7 as accepted behavior with reasoned notes (the existing task watcher already covers most TUI snapshot staleness; per-broadcast modal refetches are disproportionate for a display-only dependents list). Verified with focused new tests - deep-chain rendering, ambiguous-claimant merge, cross-branch completed resolution, and single-fetch graph-link navigation (the latter two shown to fail without the fixes) - plus bunx tsc --noEmit, bun run check ., and the full bun run test suite (2811 pass, 0 fail).

Review follow-up (Codex P1 on the item-4 fix): joining cross-branch completed records deduplicated by canonical ID, so a branch file claiming a locally-completed ID was dropped and the identity read as resolved instead of ambiguous. Deriving the collision from the merged records is unsound in general - the identity index resolves each identity to at most one record and emits none when its newest record is archived or unparseable - so ambiguity is now taken from the index itself: TaskIdentityIndex.getContestedIds() reports the IDs more than one live identity claims, loadTaskCorpus carries them on TaskCorpus.ambiguousIds, and createTaskRecordIndex seeds those keys as ambiguous, which covers readiness and the dependency graph together. The merge went back to plain ID deduplication. Two tests, each verified to fail without its mechanism: a branch completed file colliding with a local completed record, and a corpus carrying a collision its records cannot show. Full suite 2805 pass, 8 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dispositioned all seven PR #960 follow-ups: fixed items 1-4 and 6 (iterative tree walks in the formatter and tree builder, cursor-based BFS, fail-closed claimant-group merge for the filtered TUI corpus, cross-branch completed records joining the web graph corpus, and a matching-task-ID guard before the web modal sync compares dependency lists), and closed items 5 and 7 as accepted behavior with reasoned notes (the existing task watcher already covers most TUI snapshot staleness; per-broadcast modal refetches are disproportionate for a display-only dependents list). Verified with focused new tests - deep-chain rendering, ambiguous-claimant merge, cross-branch completed resolution, and single-fetch graph-link navigation (the latter two shown to fail without the fixes) - plus bunx tsc --noEmit, bun run check ., and the full bun run test suite (2811 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
