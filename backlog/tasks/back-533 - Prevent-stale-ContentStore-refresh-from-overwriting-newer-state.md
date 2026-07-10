---
id: BACK-533
title: Prevent stale ContentStore refresh from overwriting newer state
status: Done
assignee:
  - '@issue753-takeover'
created_date: '2026-07-10 19:28'
updated_date: '2026-07-10 22:45'
labels:
  - concurrency
  - release-blocker
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/753'
modified_files:
  - src/core/content-store.ts
  - src/test/content-store.test.ts
priority: high
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #753 reports a release-blocking read-after-write race: an older asynchronous ContentStore refresh can complete after a newer persisted edit/upsert and publish stale in-memory state. Treat the issue as evidence, reproduce the ordering failure deterministically, and preserve canonical shared-store semantics without adding adapter-specific behavior or a new service layer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A deterministic held-older/newer-write regression proves stale refresh completion cannot overwrite the newer task state
- [x] #2 Immediate task read, list, and search consumers observe the persisted edit rather than an older refresh snapshot
- [x] #3 The shared publication-order guarantee applies consistently to tasks, documents, decisions, configuration, and root lifecycle without cross-root leakage
- [x] #4 Genuine external watcher changes still refresh state, including after shutdown and restart
- [x] #5 Duplicate-repair serialization and existing watcher semantics remain intact
- [x] #6 Focused stress, typecheck, Biome, full tests, and compiled build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace ContentStore refresh, watcher, upsert, initialization, root-switch, and shutdown publication paths and reproduce the stale completion with deterministic gates.
2. Introduce the smallest store-owned ordering/generation guard so only the newest relevant publication can commit, with lifecycle invalidation and no adapter-specific layer.
3. Add deterministic task regression coverage plus shared-store/lifecycle tests where the same publication mechanism applies.
4. Run focused stress reruns, static checks, the full suite, and compiled build; record exact evidence before independent review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deterministic baseline reproduced the issue before the fix: held refresh A captured task type bug; a newer persisted save plus upsert published feature; releasing A reverted the cache to bug.

Implemented one ContentStore-owned latest-generation guard per tasks/documents/decisions collection, derived from the existing config-watcher generation pattern. Async loaders publish only while their generation and root epoch remain current; direct task upserts and collection replacement invalidate older loads. Root epochs and the existing serialized queue remain unchanged.

Evidence: focused ContentStore/SearchService 15/15; MCP semantic type edit/read regression passed; deterministic held-A/newer-B tests passed 50 consecutive stress reruns; existing A→B→A custom-root, disposal/restart, config watcher, duplicate repair, and Web/server update tests passed in the full suite. Static/full: TypeScript passed; Biome 324 files passed; git diff --check passed; compiled build passed; full isolated suite 1,645 passed, 2 expected interactive skips, 0 failed, 6,709 assertions across 189 files in 194.49s.

Independent concurrency review initially returned CHANGES REQUIRED: a collection token could cancel an unrelated targeted task event, and same-root config snapshots did not validate collection generations. Corrected both before refreezing. Targeted task/document/decision loads now use per-item generations; full collection replacements invalidate held item generations. Initialization and config publication now retry one coherent tasks/documents/decisions snapshot until every collection generation and the root epoch remain current.

Added deterministic regressions for held TASK-1 refresh plus unrelated TASK-2 upsert, and held same-root config snapshot plus newer persisted task upsert. Corrected focused ContentStore/SearchService passed 17/17; the four ordering regressions passed 50 consecutive reruns. Final corrected verification: TypeScript passed; Biome 324 files passed; git diff --check passed; compiled build passed; full isolated suite 1,647 passed, 2 expected interactive skips, 0 failed, 6,712 assertions across 189 files in 218.57s.

Final correction after independent spec review: separated full-refresh request generations from collection publication versions. A full refresh invalidated by an unrelated upsert now reloads until it can publish a coherent snapshot, while a newer full refresh still supersedes the older request. Added a deterministic regression for the exact unrelated-upsert/full-refresh interleaving.

Final verification on the corrected tree: five focused ordering tests passed; ContentStore + SearchService passed (18 tests, 66 assertions); five ordering regressions passed 50 consecutive stress runs; typecheck, Biome, diff check, and build passed; authoritative full suite passed 1,648 tests with 2 expected interactive skips and 0 failures (6,713 assertions, 189 files). An earlier full run had one 10-second server-search teardown timeout under suite load; the isolated file immediately passed 25/25, and the clean full rerun passed.

Final spec review of fingerprint 77d54fa found a remaining validation/publication microtask gap: loadCurrentCollection and loadCurrentContent validated versions, returned across an await, then callers replaced state. The reviewer reproduced a newer synchronous upsert being overwritten 50/50. Corrected by moving collection and coherent-snapshot publication callbacks into the same synchronous turn as the successful generation/version check. Added the exact public refreshTasks five-microtask regression. Focused ContentStore + SearchService: 19 passed, 67 assertions; exact regression: 50/50 stress passes; typecheck, Biome, diff check, and build pass; final full suite: 1,649 passed, 2 expected interactive skips, 0 failed, 6,714 assertions across 189 files.

Independent quality review of fingerprint d9e6b443 found a P2 starvation risk: coherent refresh loops retried without a bound, while even identical upserts advanced the collection version. Corrected by making identical task upserts no-ops and bounding coherent refresh attempts; exhaustion returns without publishing stale content so queued watcher/config work can proceed. Added deterministic regressions for identical-upsert suppression and sustained invalidation termination without stale publication. Focused ContentStore + SearchService: 21 passed, 71 assertions; atomicity and sustained-invalidation regressions each passed 50/50 stress runs; typecheck, Biome, diff check, and build pass; final full suite: 1,651 passed, 2 expected interactive skips, 0 failed, 6,718 assertions across 189 files.

Final spec review of bounded-retry fingerprint found a P1: exhausting the cap could still permanently lose an unrelated external update. Replaced collection-wide retry-on-change with single-pass per-item reconciliation. Each load captures the cache before reading; at publication it preserves actual concurrent cache additions, updates, and deletions per item while accepting disk changes for untouched items, then publishes synchronously under the existing root and refresh-generation checks. Removed the now-unneeded collection version counters and retry loops. Added the exact two-task regression: 20 concurrent TASK-2 upserts are preserved while TASK-1 external disk content lands; refresh terminates after one loader pass. Seven ordering regressions passed 50/50 stress runs; focused ContentStore + SearchService passed 21 tests; typecheck, Biome, diff check, and build pass; final full suite passed 1,651 tests with 2 expected interactive skips and 0 failures (6,717 assertions, 189 files).

Final spec review of value-reconciliation fingerprint found a P1 ABA gap: base → intermediate → base during a held load compared equal to the captured value and allowed stale disk content to win. Corrected by separating per-item publication versions from per-item request generations. Every actual targeted/upsert add, update, or delete advances the publication version; reconciliation compares versions captured before the load, so ABA and delete/re-add cycles are preserved without treating mere read attempts as publications. Added the exact public refreshTasks ABA regression. Nine concurrency regressions passed 50/50 stress runs; focused ContentStore + SearchService passed 22 tests; typecheck, Biome, diff check, and build pass; final full suite passed 1,652 tests with 2 expected interactive skips and 0 failures (6,718 assertions across 189 files).

Publication gate: final frozen fingerprint f888e6cb2db68cc12283260d1a5381ef949a3307b292140b5434a7390b205b64 received independent APPROVED verdicts from both spec/concurrency and code-quality reviewers. Reviewer stress evidence included all prior P1 reproductions at 50/50 each, nine focused concurrency scenarios at 180/180, focused ContentStore + SearchService at 22/22, and root/custom-root lifecycle coverage. Authorized for commit, push, and ready-for-review PR; task intentionally remains In Progress until merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented stale ContentStore refreshes from overwriting newer state through guarded full-refresh generations and per-item publication reconciliation. Added deterministic coverage for same-item, unrelated-item, microtask, starvation, and ABA orderings. Verified with 1,652 full-suite passes, static checks, build, stress reruns, independent spec and quality approvals, and publication as PR #757.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
