---
id: BACK-535.5
title: Replace vacuous catch-based test assertions
status: To Do
assignee: []
created_date: '2026-07-11 10:56'
updated_date: '2026-07-11 10:58'
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
- [ ] #1 Each of the three board-config-simple cases fails when its intended checkActiveBranches progress behavior is absent and cannot pass merely because loadTasks rejects
- [ ] #2 The offline-mode fetch case asserts one deterministic observable contract and cannot pass for arbitrary errors
- [ ] #3 Any removed test names the retained replacement coverage and why no public behavior is lost
- [ ] #4 No production behavior changes
- [ ] #5 Focused stress, full local gates, and supported-platform CI pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Identify the observable contract intended by each of the four catch-based tests and name retained neighboring coverage.
2. Replace each vacuous catch with deterministic success/failure assertions, or remove it only with evidence that retained coverage protects the same behavior.
3. Keep the slice test-only and do not change production behavior.
4. Run focused repeated stress, full static/build/test gates, and supported-platform CI.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
