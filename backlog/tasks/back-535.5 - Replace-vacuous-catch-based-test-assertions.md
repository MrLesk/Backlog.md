---
id: BACK-535.5
title: Replace vacuous catch-based test assertions
status: In Progress
assignee:
  - '@test-hygiene-assertions'
created_date: '2026-07-11 10:56'
updated_date: '2026-07-11 16:13'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: medium
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repair or remove four catch-based tests that currently pass without proving an observable contract: src/test/board-config-simple.test.ts:72, :131, and :183 can reject before their progress assertions, while src/test/offline-mode.test.ts:75 accepts either success or any defined error. This is test-only work: identify the shipped or domain contract, replace each site with deterministic observable assertions, or remove it only with evidence of retained coverage. Do not change production behavior.

Inventory boundary after merging main 251aba8: these four sites are distinct from 37 BACK-535.3 pre-clean, 59 BACK-535.3 teardown, 24 BACK-535.4 resource, and 22 legitimate explicit sites; the complete total is 146.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each of the three board-config-simple cases fails when its intended checkActiveBranches progress behavior is absent and cannot pass merely because loadTasks rejects
- [x] #2 The offline-mode fetch case asserts one deterministic observable contract and cannot pass for arbitrary errors
- [x] #3 Any removed test names the retained replacement coverage and why no public behavior is lost
- [x] #4 No production behavior changes
- [ ] #5 Focused stress, full local gates, and supported-platform CI pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Identify the observable contract and retained neighboring coverage for each of the three board progress cases and the offline fetch case.
2. Replace catch-based pass paths with deterministic observable success/failure assertions, or remove only with explicit retained-coverage evidence.
3. Keep the slice test-only, run repeated focused stress and full static/build/test gates, and obtain independent specification and quality reviews.
4. Publish the bounded PR and require unified Linux, macOS, and Windows CI plus CodeQL before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter L1 micro-brief: board-loading.test.ts is the closest retained analog for checkActiveBranches false/true/undefined and already uses deterministic Core fixtures and explicit progress assertions; board-config-simple is an older mock-heavy duplicate whose catch blocks can bypass every assertion. offline-mode already mocks GitOperations.execGit in the neighboring network-error test, providing the native pattern for proving that remoteOperations=true reaches the fetch command without depending on repository or network failure. Main risks are deleting unique progress-copy coverage, retaining a mock that fails before the assertion, or replacing one vacuous path with platform/network dependence. No new production identifiers or behavior are needed.

Retained coverage mapping (test titles, intentionally line-independent):

- Deleted "should respect checkActiveBranches=false in Core.loadTasks" is retained by Board Loading with checkActiveBranches > Core.loadTasks() > "should skip cross-branch checking when checkActiveBranches is false".
- Deleted "should respect checkActiveBranches=true in Core.loadTasks" is retained by Board Loading with checkActiveBranches > Core.loadTasks() > "should perform cross-branch checking when checkActiveBranches is true".
- Deleted "should handle undefined checkActiveBranches (defaults to true)" is retained by Board Loading with checkActiveBranches > Config integration > "should use default values when config properties are undefined".

These retained tests use real initialized Core fixtures, await a successful loadTasks result, assert loaded tasks, and deterministically assert the current "Applying latest task states from branch scans..." progress contract for false/true/undefined. The stale strings "Skipping cross-branch check (disabled in config)" and "Resolving task states across branches" are absent from the current production and retained test suite, so removing the duplicate mock-heavy file loses no public behavior or current progress-copy coverage.

Offline exact fetch contract: Offline Mode Configuration > GitOperations.fetch() > "should proceed with fetch when remoteOperations is true" forces hasAnyRemote=true, captures execGit, and asserts exactly ["fetch", "origin", "--prune", "--quiet"]. It is deterministic and requires neither a repository remote nor network access; arbitrary errors can no longer make it pass.

Scope and review evidence: test-only diff; no production files or behavior changed. Independent specification review APPROVED and independent quality review APPROVED. Validation passed: focused 19 tests / 43 assertions; full 1,662 tests passed + 2 intentional skips / 0 failed / 6,791 assertions / 187 files; bunx tsc --noEmit passed; bun run check . passed (323 files); bun run build passed; git diff --check passed. AC5 remains open pending supported-platform GitHub 3OS CI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed a vacuous duplicate board-config test file in favor of deterministic retained board-loading coverage and replaced the offline fetch catch-based assertion with an exact, network-free fetch-command contract. This is test-only with no production behavior changes. Local focused, full test, typecheck, Biome, build, and diff checks passed; specification and quality reviews approved. Task remains In Progress until supported-platform GitHub 3OS CI satisfies AC5.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
