---
id: BACK-533
title: Prevent stale ContentStore refresh from overwriting newer state
status: In Progress
assignee:
  - '@pr755-f768-code'
created_date: '2026-07-10 19:28'
updated_date: '2026-07-11 10:24'
labels:
  - concurrency
  - release-blocker
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/753'
modified_files:
  - src/core/content-store.ts
  - src/test/content-store.test.ts
  - src/test/server-tasks-spa-fallback.test.ts
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
1. Make the lifecycle regression self-cleaning and phase-diagnostic: cancel event subscriptions/timers on settle, label every watcher/config wait, and ensure helper timeouts fire before Bun’s outer Windows test timeout without increasing either limit.
2. Push the test-only diagnostic head and use Windows CI to identify the exact stalled transition; do not infer a production fix from local-only passes.
3. Correct the smallest proven watcher or test-lifecycle defect while preserving epoch/root publication guarantees and existing config watcher semantics.
4. Re-run focused Windows-equivalent stress, impacted/full tests, TypeScript, Biome, build, and fresh independent spec plus quality reviews before a new final-head CI gate.
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

Post-publication exact-head review closed the merge gate with two deterministic P1 gaps: concurrent persisted publications during initialization can be dropped and overwritten by the initial stale snapshot; a late publication owned by root A can be reconciled into root B during A→B transition. PR #757 remains open but must not merge until both gaps are fixed, fully reverified, and independently reapproved.

Final lifecycle correction and verification: publication ownership now uses physical-root provenance while watcher instance cancellation remains epoch-based; initialization retries bounded coherent root attempts across structure creation, content load, and watcher binding; stable reconciliation requires configured root, published cache owner, and active watcher owner to match; watcher invalidation advances epoch before stopping; ambiguous pathless direct upserts fail closed unless an explicit root owner is supplied; pre-ready state changes remain internal until one coherent ready event. Frozen code/test fingerprint f75bbda2 received independent spec/concurrency APPROVED and independent quality/simplicity APPROVED with no P1/P2/P3. Final verification: impacted tests 62/62; expanded 23-scenario lifecycle matrix 1,150/1,150; TypeScript, Biome across 324 files, diff check, and compiled build passed; authoritative full suite 1,672 passed, 2 expected interactive skips, 0 failed, 6,779 assertions across 189 files.

Merge gate reopened after exact-head Windows CI reproduced the A→B→A watcher lifecycle test timeout twice at 30 seconds. Two outstanding event waits then rejected after the outer timeout and contaminated the following test. No merge; add phase-local diagnostics and correct the Windows-specific behavior/test before re-verification.

Windows diagnostic head f2f5693 localized the repeated failure in CI run 29133276160, job 86492659570: `Timed out waiting for held root B config load` after 10.216 seconds. The queue never reached the config snapshot loader. Self-cleaning labeled waits prevented the prior rejection leak, and the following ContentStore test passed. Independent BACK-534 investigation on main measured duplicate unchanged watcher work occupying the same serialized queue for 4,986 ms in targeted retry plus 4,987 ms in fallback refresh (9,973 ms total). Keep PR #757 blocked and do not duplicate that shared production fix here; rebase onto corrected main after BACK-534 lands, then reassess the temporary diagnostic harness and rerun all gates.

Integrated corrected main/BACK-534 without force. Preserved physical-root publication ownership and per-item generation/version reconciliation while adopting bounded coalesced deferred watcher rechecks outside the serialized queue. Removed superseded watcher/refresh/retry implementations after semantic merge. Kept the self-cleaning labeled lifecycle waits; replaced one flaky native fs.watch delivery assertion with deterministic bound-root and active-watcher invariants after reproducing the flake 1/4, then passed that transition pair 100/100. Final merged verification: focused ContentStore/Search/MCP 85/85; critical lifecycle/concurrency stress 40/40 plus transition recovery 100/100; TypeScript, Biome (322 files), diff check, build green; authoritative isolated suite 1,663 passed, 2 expected interactive skips, 0 failed, 6,796 assertions across 188 files in 171.37s. Full log: /tmp/back533-final-full.log.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
