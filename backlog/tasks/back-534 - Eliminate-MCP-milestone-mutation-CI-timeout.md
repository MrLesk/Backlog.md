---
id: BACK-534
title: Eliminate MCP milestone mutation CI timeout
status: Done
assignee:
  - '@mcp-milestone-ci'
created_date: '2026-07-11 00:41'
updated_date: '2026-07-11 09:17'
labels:
  - ci
  - mcp
  - concurrency
dependencies: []
modified_files:
  - src/core/content-store.ts
  - src/test/content-store.test.ts
  - src/test/mcp-milestones.test.ts
priority: high
type: bug
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Linux full-suite CI repeatedly times out the MCP milestone task_create/task_edit regression at 10 seconds while the same test passes quickly in isolation. Find the deterministic wait, leaked resource, or concurrency interaction rather than masking it with a larger timeout. Keep this repair isolated from PR #757.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The full-suite interaction that causes the MCP milestone mutation test to stall is reproduced or localized with deterministic focused coverage
- [x] #2 The underlying wait, resource leak, or concurrency defect is fixed without increasing the test or CI timeout
- [x] #3 Focused regression coverage proves task_create milestone assignment and task_edit milestone clearing complete and preserve existing semantics
- [x] #4 TypeScript, Biome, focused tests, full isolated tests, and compiled build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add deterministic fake-watcher regressions for task, document, and decision events where the first same-identity read is the unchanged cache, changed bytes appear later, and no second watcher event fires.
2. Replace in-queue retry sleeps with coalesced per-identity deferred rechecks scheduled outside chainTail; each timer enqueues one targeted reconciliation read and uses root epoch, disposal, and watcher-stop guards.
3. Preserve fast duplicate no-ops, wrong-identity rejection, incomplete-read recovery, collection symmetry, and filename/existence-driven deletion; cover root-change and disposal cancellation.
4. Treat every identity present in a successful wildcard snapshot as authoritative for stale-job cancellation before content equality checks, including same-content filename-only task, document, and decision renames.
5. Preserve absent-identity recovery and wildcard no-polling, then stress queue timing, delayed/incomplete reads, identity, deletion, rename publication, root lifecycle, and MCP milestone mutation.
6. Run TypeScript, Biome, build, diff review, and the full isolated suite; record fail-first and final verification fingerprints for sequential review without pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation localized both Ubuntu failures to duplicate ContentStore task reconciliation, not MCP transport or the task-create lock. CI continued the timed-out test and later reported its clear assertion after subsequent tests had begun. The serialized watcher path requires a task to differ from the cached snapshot; when an in-process write already published that snapshot, retryRead waits 4,950ms and the collection fallback waits another 4,950ms. A deterministic local probe measured 4,986ms + 4,987ms = 9,973ms, matching the 10s CI timeout. The fix will preserve retries for invalid reads but treat valid unchanged snapshots as completed no-ops.

Implemented shared ContentStore no-op reconciliation: readable expected task, document, and decision snapshots now leave retryRead immediately, while post-read change detection suppresses duplicate publication. The deterministic fail-first test initially observed 22 scheduled delays in the task targeted-plus-collection path; the standalone baseline probe measured 9,973ms. The final queue-liveness regression covers all three content types and schedules zero delays, while its paired incomplete-read regression proves two invalid reads still schedule 75ms and 150ms retries before publication. Focused verification: ContentStore plus MCP milestone suites 42/42; queue/retry stress 200/200; watcher-enabled MCP task_create milestone assignment and task_edit clearing stress 50/50. Static/build verification: bunx tsc --noEmit, bun run check ., bun run build, and git diff --check passed. Final full verification: bun test --isolate --timeout=10000 passed 1,646 tests with 2 intentional skips and 0 failures across 189 files.

Spec review of bf247f5 found that targeted task and decision reads accepted any non-null entity. The fail-first regression returned foreign ID, then null, then the requested entity; bf247f5 stopped after one read instead of three and could publish TASK-999 or decision-999. Re-audit reasoning: updateTaskFromDisk and updateDecisionFromDisk are invoked only after the patched filesystem save promise completes. A parsed result with the requested identity—even if already equal to the cache—is therefore a converged no-op published earlier in the queue. Null or a different identity cannot represent the completed requested save and must remain retryable. The document collection path already requires the expected document ID before publication, and direct watcher parsers validate filename identity. Deletion is separate: watcher branches require exists=false and remove only the filename-derived cached ID; focused coverage now exercises task, document, and decision deletion together.

Review fix completed: targeted task reads now require taskIdsEqual with the normalized requested ID, and targeted decision reads require exact decision ID equality. The fail-first fingerprint on bf247f5 was expected three reads but received one after a foreign-ID result; the corrected regression observes foreign ID, null, then the requested entity and proves no foreign task, document, or decision ID is ever published. The analogous document collection validator was already identity-strict. An initial simultaneous three-file deletion stress exposed watcher event coalescing in the test itself, so deletion coverage now removes and observes task, document, and decision sequentially; it passed 100/100 without timeout changes. Final review-fix verification: focused ContentStore plus MCP suites 42/42 with 179 assertions; queue/retry stress 200/200; deletion stress 100/100; MCP milestone create/clear stress 50/50; bunx tsc --noEmit, bun run check ., bun run build, and git diff --check passed. Full bun test --isolate --timeout=10000 passed 1,646 with 2 intentional skips, 0 failures, and 6,720 assertions across 189 files in 172.32s.

Quality audit of 0125c0e identified a delayed-valid-write gap: a single filesystem event can observe old but valid same-identity bytes, treat them as a completed no-op, and never see later changed bytes when no second event arrives. The follow-up will model exactly one watcher callback with captured fake node:fs watchers and keep every retry delay outside the shared serialized chain.

Quality-audit correction completed. Exact fail-first harness replaces node:fs.watch with captured callbacks, fires one task, document, and decision change event while disk still exposes the cached same-identity bytes, waits for the shared queue to drain, then writes changed bytes through an unpatched FileSystem without a second event. On 0125c0e it failed in 1.055s with “Timed out waiting for delayed content visibility after one watcher event”; the corrected implementation converges in about 80–107ms.

ContentStore now uses one epoch-bound, per-identity deferred recheck registry. Every queue turn performs a single read; invalid or direct-watcher unchanged observations arm the existing 12-attempt linear backoff outside chainTail, and each timer enqueues a fresh targeted read against current disk and cache state. Same-key events coalesce without resetting the job, successful/new/deleted observations cancel it, and root watcher stop/dispose clear timers and tokens. Task direct reads preserve filePath so an old snapshot compares equal accurately. Wildcard collection no-ops deliberately remain terminal: an initial attempt to retry them caused pending collection loads to steal the lifecycle test’s config-load gate; after restoring the targeted-vs-wildcard policy, A→B→A lifecycle stress passed 20/20.

Final corrective verification: ContentStore 11/11 with 68 assertions; MCP milestones 33/33 with 127 assertions; queue/delayed/lifecycle/incomplete stress 200/200; deletion stress 50/50; MCP milestone create/clear stress 50/50; A→B→A lifecycle stress 20/20. bunx tsc --noEmit, bun run check . (324 files), bun run build, and git diff --check passed. Authoritative bun test --isolate --timeout=10000 passed 1,648 tests with 2 intentional skips, 0 failures, and 6,736 assertions across 189 files in 173.86s.

Second quality review found a stale-path race: a direct watcher could schedule an unchanged old-path retry, then wildcard rename reconciliation could publish the same identity from its new path without cancelling the identity job. Firing the old timer afterward deleted the freshly published task, document, or decision. Deterministic fail-first on a0f670b published all three renamed entities, fired the captured old timers with no later event, and failed first at the task assertion: expected Renamed Task, received undefined. The smallest shared correction cancels each published entity identity key from the existing deferred registry inside collection replacement; absent identities keep their recovery jobs, and wildcard unchanged reads remain terminal.

Stale-path correction verification: deterministic rename regression passed 50/50 with 600 assertions; the complete ContentStore suite passed 10/10 runs with 120 tests and 800 assertions; the watcher-enabled MCP milestone blocking regression passed 5/5. Focused ContentStore plus MCP suites passed 45/45 with 207 assertions. bunx tsc --noEmit, bun run check . (324 files), bun run build, and git diff --check passed. Authoritative bun test --isolate --timeout=10000 passed 1,649 tests with 2 intentional skips, 0 failures, and 6,748 assertions across 189 files in 187.13s.

Final spec review found that replacement-level cancellation still depended on collection change detection. Decision snapshots do not expose filenames, so renaming a decision file without changing its bytes produced an equal wildcard snapshot, skipped replacement, and left the old-path identity job live. The exact fail-first moved task, document, and decision files to cosmetic filenames without changing content, published wildcard snapshots, then fired captured old timers with no later event. Task and document survived because their models carry paths; decision failed with expected Adopt shared cache, received undefined. The corrected wildcard rule cancels pending identity jobs for every identity successfully observed before content-equality early return. Empty or missing identities are not cancelled, preserving recovery, and wildcard no-op snapshots still do not poll.

Same-content wildcard verification: filename-only task, document, and decision rename regression passed 50/50 with 600 assertions; complete ContentStore suite passed 10/10 runs with 120 tests and 800 assertions; watcher-enabled MCP milestone blocking regression passed 5/5. Focused ContentStore plus MCP suites passed 45/45 with 207 assertions. bunx tsc --noEmit, bun run check . (324 files), bun run build, and git diff --check passed. Authoritative bun test --isolate --timeout=10000 passed 1,649 tests with 2 intentional skips, 0 failures, and 6,748 assertions across 189 files in 173.53s.

Final quality simplification: removed redundant deferred-job cancellation from generic collection replacement helpers. Cancellation now has one responsibility site: successful wildcard reconciliation cancels every present identity before collection-equality evaluation. Verification after cleanup: ContentStore 12/12 and 10x stress 120/120; MCP milestones 33/33 and blocking case 5/5; full isolated suite 1,649 pass, 2 expected skips, 0 fail, 6,748 assertions across 189 files; TypeScript, Biome (324 files), build, and diff-check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the serialized watcher retry stalls that pushed MCP milestone mutations to the 10-second CI limit. ContentStore now uses bounded, coalesced deferred targeted rechecks outside the shared queue, validates expected identities, and safely cancels stale old-path jobs when wildcard snapshots confirm current task, document, or decision identities. Deterministic coverage includes delayed single-event visibility, wrong identities, deletions, identical-content filename renames, coalescing, root/disposal cancellation, queue liveness, and A-to-B-to-A lifecycle behavior. Final verification: 1,649 tests passed with 2 expected TUI skips and 0 failures; focused and stress suites, TypeScript, Biome, build, and diff checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
