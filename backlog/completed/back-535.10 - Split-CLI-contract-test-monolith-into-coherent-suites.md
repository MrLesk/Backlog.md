---
id: BACK-535.10
title: Split CLI contract test monolith into coherent suites
status: Done
assignee:
  - '@back53510-publish-finalize'
created_date: '2026-07-11 17:55'
updated_date: '2026-07-11 18:19'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: medium
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reclassify and split src/test/cli.test.ts into focused test files aligned to shipped CLI contracts. Preserve every test name and assertion semantics unless an exact retained replacement is documented; limit the change to test structure and reused test helpers, with no production behavior or production-file changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every describe and test from src/test/cli.test.ts is mapped to a shipped public CLI contract and a coherent destination suite
- [x] #2 The monolith is split into focused test files without deleting public-contract coverage or changing production files
- [x] #3 Extracted suites pass individually and together under repeated CLI stress runs
- [x] #4 Full tests, TypeScript, Biome, and build verification pass, and the final diff is reviewed for semantic preservation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory all 14 nested describe blocks and 99 test names, classify each against the shipped CLI contract, and record any hybrid Core-backed setup/assertion without deleting it.
2. Mechanically extract independent top-level suites into six command-family files, preserving the outer CLI Integration suite name, every test name, body, timeout, and assertion; keep only imports required by each destination.
3. Run each extracted file, repeated combined CLI stress, then full test/type/Biome/build gates and inspect semantic and line-count diffs.
4. Re-read the split for simplification, finalize objective evidence, and mark the task Done before the final-head verification matrix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter L2 brief: reviewed src/test/cli.test.ts, nearby cli-root-entry.test.ts and cli-plain-create-edit.test.ts, src/test/test-utils.ts usage, and recent CLI-test history. Existing convention is cli-<command-family>.test.ts with per-file isolated temp lifecycle via createUniqueTestDir/safeCleanup. The 14 nested suites share no local implementation helpers beyond the outer fixture; six balanced files keep command contracts coherent without adding a new abstraction. Main risk was silent semantic loss during a large move. Six early init tests use Core directly for setup/assertion and are hybrid coverage rather than pure subprocess coverage; this slice preserves and explicitly records them because replacing behavior is outside the tests-only structural scope.

Implemented six-file structural extraction. Objective preservation evidence: independent files pass 15+23+14+20+13+14 = 99 tests; normalized source-slice diff reports semantic-slices-match; combined --rerun-each 3 stress passes 297/297 with 1,530 expectations. All 14 nested describe names and all 99 test names match origin. New files total 2,861 lines versus the 2,758-line monolith; the 103-line increase is isolated fixture/import wrapper overhead. No shared helper was added because abstracting per-file Bun hooks and mutable TEST_DIR would add indirection without changing behavior. No tests, assertions, timeouts, or production files were removed or changed.

Verification: one preliminary full run had a transient unrelated server readiness failure after 1,652 passes; that exact test passed immediately in isolation. The post-Done final-head matrix then passed: bun test 1,653 pass / 2 intentional skips / 0 fail with 6,785 expectations across 192 files; bunx tsc --noEmit; bun run check . (328 files); bun run build; and git diff --check.

Process hold: implementation and verification are complete, but the task remains In Progress pending independent spec and quality approvals.

Final mapping and count correction: cli-guidance.test.ts contains root command, backlog instructions command, command help input schemas, and self-correcting CLI errors (4 suites / 15 tests); cli-init-create.test.ts contains backlog init command, git integration, and create commands (3 / 23); cli-task-list.test.ts contains task list command (1 / 14); cli-task-view-edit.test.ts contains task view command, task shortcut command, and task edit command (3 / 20); cli-task-state.test.ts contains task archive and state transition commands (1 / 13); cli-doc-decision-board.test.ts contains doc and decision commands and board view command (2 / 14). Aggregate: 14 nested suites, 99 tests, and 510 Bun expectation calls. The six-file independent aggregate passed 99/99 with 510 expectations; 3x stress passed 297/297 with 1,530 expectations.

Independent review gates: specification review cycle 1 APPROVED and quality review cycle 1 APPROVED, with circuit breaker 0/3. Both reviews accepted the tests-only structural split and semantic-preservation evidence without requested changes.

Local final evidence on current origin/main base 20a159e: exact six-file aggregate 99 pass / 510 expectations; stress 297 pass / 1,530 expectations; full suite 1,653 pass / 2 intentional skips / 0 fail, 6,785 expectations across 192 files in 142.12s; bunx tsc --noEmit passed; bun run check . passed for 328 files; bun run build passed; git diff --check and no-index whitespace checks for all six new files passed. The one earlier full-suite red was an unrelated transient server-readiness failure after 1,652 passes: the exact test passed immediately in isolation and the subsequent final full run passed, so no product or test change was warranted. Pre-publish remote matrix red count was 0/2.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split the 2,758-line CLI integration monolith into six coherent command-family suites with no production changes. Preserved all 14 nested suites, 99 tests, 510 expectation calls, names, timeouts, and assertion semantics; exact mapping/parity review, independent spec and quality approvals, 3x stress, the 1,653-test full suite, TypeScript, Biome, build, and diff validation all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
