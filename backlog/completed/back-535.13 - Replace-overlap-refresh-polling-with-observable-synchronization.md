---
id: BACK-535.13
title: Replace overlap-refresh polling with observable synchronization
status: Done
assignee:
  - '@back535-overlap-race-fix'
created_date: '2026-07-11 20:31'
updated_date: '2026-07-11 20:49'
labels: []
dependencies: []
modified_files:
  - src/test/web-task-detail-deeplink.test.tsx
parent_task_id: BACK-535
priority: high
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stabilize the unchanged web task-detail deep-link overlap-race test that failed on Ubuntu in GitHub Actions run #772. The test currently polls fifty times at 5 ms and can assert before the newer overlapping refresh result renders under load. Replace only that brittle wall-clock polling with deterministic observable synchronization while preserving the existing race behavior and diagnostics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The overlap-refresh test waits for the newer refresh result through observable synchronization rather than a fixed 50x5ms polling budget or a larger timeout
- [x] #2 The test still proves that an older overlapping refresh cannot overwrite the newer rendered result
- [x] #3 No production or mobile behavior changes are introduced
- [x] #4 Focused stress, the relevant browser test suite, full tests, typecheck, Biome, and build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the failing test, nearby synchronization patterns, and the exact React state transition.
2. Reproduce the existing timing sensitivity under focused load and retain fail-first evidence if observed.
3. Signal when the newer mocked search response body is consumed, await that observable event inside React act, then assert the rendered result immediately.
4. Run focused stress, the relevant rendered test suite, and full repository quality gates; review the final diff for scope and simplification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fail-first reproduction did not occur locally: the unchanged test passed 200/200 focused repetitions, consistent with an Ubuntu load-sensitive race. Root cause: the test used a fixed 50 × 5 ms polling loop after emitting the newer refresh, so elapsed scheduler time—not the mocked refresh lifecycle—decided when the DOM assertion ran.

Implementation: wrapped only the newer queued search Response.json method to resolve a deferred signal after the body is consumed; awaited that signal inside React act and drained the associated microtask before the immediate rendered-title assertion. No production code, product behavior, mobile behavior, polling loop, per-case timer, retry, or timeout changed.

Validation: focused overlap test 500/500 pass; src/test/web-task-detail-deeplink.test.tsx 21/21 pass; full bun test 1653 pass, 2 intentional interactive-TUI skips, 0 fail across 192 files in 219.19s; bunx tsc --noEmit pass; bun run check . pass (328 files); bun run build pass; git diff --check pass.

Scope review: code diff is limited to src/test/web-task-detail-deeplink.test.tsx (16 insertions, 5 deletions) plus this task record. The CLI-created archived BACK-535.12 allocator-collision artifact is intentionally local-only and excluded from every diff/publication scope; it must not be staged or committed.

Review gate: independent specification review cycle 1 APPROVED; independent quality review cycle 1 APPROVED with circuit breaker 0. Implementer focused stress: 500/500. Independent specification reviewer: 100/100 additional focused repetitions. Independent quality reviewer: 101/101 additional focused repetitions. The unchanged local baseline passed 200/200 while the external Ubuntu run supplied the red fail-first evidence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the overlap-refresh test’s fixed 50 × 5 ms polling with a deferred signal tied to consumption of the newer mocked search response body. React act now flushes that observable refresh lifecycle before an immediate DOM assertion, preserving the stale-response race coverage and diagnostics without changing production behavior or timeouts. All four acceptance criteria and all three Definition of Done items are satisfied. Verified with unchanged local baseline 200/200 (external Ubuntu red evidence), implementer focused stress 500/500, independent specification reviewer 100/100 additional focused repetitions, independent quality reviewer 101/101 additional focused repetitions, the 21-test rendered file, full 1,653-pass + 2 intentional skips / 0 failures across 192 files, typecheck, Biome, build, and scoped diff review. Specification and quality review cycle 1 both APPROVED; quality circuit breaker 0.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
