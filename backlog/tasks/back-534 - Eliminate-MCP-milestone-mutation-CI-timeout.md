---
id: BACK-534
title: Eliminate MCP milestone mutation CI timeout
status: In Progress
assignee:
  - '@mcp-milestone-ci'
created_date: '2026-07-11 00:41'
updated_date: '2026-07-11 01:16'
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
- [ ] #1 The full-suite interaction that causes the MCP milestone mutation test to stall is reproduced or localized with deterministic focused coverage
- [ ] #2 The underlying wait, resource leak, or concurrency defect is fixed without increasing the test or CI timeout
- [ ] #3 Focused regression coverage proves task_create milestone assignment and task_edit milestone clearing complete and preserve existing semantics
- [ ] #4 TypeScript, Biome, focused tests, full isolated tests, and compiled build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the CI evidence and deterministic queue-liveness coverage for ContentStore plus MCP milestone create/clear semantics.
2. Treat valid same-identity unchanged task, document, and decision reads as no-ops, while retrying null, missing, or wrong-identity observations until the requested entity is available.
3. Verify task, document, and decision deletion remains filename/existence-driven and independent of publication identity checks.
4. Stress focused paths, run TypeScript, Biome, full isolated tests, build, and diff review, then hand the isolated commits to sequential spec and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation localized both Ubuntu failures to duplicate ContentStore task reconciliation, not MCP transport or the task-create lock. CI continued the timed-out test and later reported its clear assertion after subsequent tests had begun. The serialized watcher path requires a task to differ from the cached snapshot; when an in-process write already published that snapshot, retryRead waits 4,950ms and the collection fallback waits another 4,950ms. A deterministic local probe measured 4,986ms + 4,987ms = 9,973ms, matching the 10s CI timeout. The fix will preserve retries for invalid reads but treat valid unchanged snapshots as completed no-ops.

Implemented shared ContentStore no-op reconciliation: readable expected task, document, and decision snapshots now leave retryRead immediately, while post-read change detection suppresses duplicate publication. The deterministic fail-first test initially observed 22 scheduled delays in the task targeted-plus-collection path; the standalone baseline probe measured 9,973ms. The final queue-liveness regression covers all three content types and schedules zero delays, while its paired incomplete-read regression proves two invalid reads still schedule 75ms and 150ms retries before publication. Focused verification: ContentStore plus MCP milestone suites 42/42; queue/retry stress 200/200; watcher-enabled MCP task_create milestone assignment and task_edit clearing stress 50/50. Static/build verification: bunx tsc --noEmit, bun run check ., bun run build, and git diff --check passed. Final full verification: bun test --isolate --timeout=10000 passed 1,646 tests with 2 intentional skips and 0 failures across 189 files.

Spec review of bf247f5 found that targeted task and decision reads accepted any non-null entity. The fail-first regression returned foreign ID, then null, then the requested entity; bf247f5 stopped after one read instead of three and could publish TASK-999 or decision-999. Re-audit reasoning: updateTaskFromDisk and updateDecisionFromDisk are invoked only after the patched filesystem save promise completes. A parsed result with the requested identity—even if already equal to the cache—is therefore a converged no-op published earlier in the queue. Null or a different identity cannot represent the completed requested save and must remain retryable. The document collection path already requires the expected document ID before publication, and direct watcher parsers validate filename identity. Deletion is separate: watcher branches require exists=false and remove only the filename-derived cached ID; focused coverage now exercises task, document, and decision deletion together.

Review fix completed: targeted task reads now require taskIdsEqual with the normalized requested ID, and targeted decision reads require exact decision ID equality. The fail-first fingerprint on bf247f5 was expected three reads but received one after a foreign-ID result; the corrected regression observes foreign ID, null, then the requested entity and proves no foreign task, document, or decision ID is ever published. The analogous document collection validator was already identity-strict. An initial simultaneous three-file deletion stress exposed watcher event coalescing in the test itself, so deletion coverage now removes and observes task, document, and decision sequentially; it passed 100/100 without timeout changes. Final review-fix verification: focused ContentStore plus MCP suites 42/42 with 179 assertions; queue/retry stress 200/200; deletion stress 100/100; MCP milestone create/clear stress 50/50; bunx tsc --noEmit, bun run check ., bun run build, and git diff --check passed. Full bun test --isolate --timeout=10000 passed 1,646 with 2 intentional skips, 0 failures, and 6,720 assertions across 189 files in 172.32s.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
