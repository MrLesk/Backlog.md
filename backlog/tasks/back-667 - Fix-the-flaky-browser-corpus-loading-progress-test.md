---
id: BACK-667
title: Fix the flaky browser corpus loading-progress test
status: To Do
assignee: []
created_date: '2026-08-30 22:14'
labels:
  - tests
  - bug
dependencies: []
ordinal: 299000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/test/server-loading-progress.test.ts ("publishes a distinct failure and retries the same shared initialization") fails intermittently on ubuntu CI under full-suite concurrency — a timing race where an expected 500-during-init-failure window returns 200. It has independently broken CI runs for PRs #933, #956, #973, and #976. Diagnose the race and make the test deterministic (observable synchronization instead of timing windows, per the BACK-535.13/.14 precedent); do not weaken the assertion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The test passes 20/20 consecutive full-suite runs locally
- [ ] #2 The failure window is synchronized on an observable state, not wall-clock timing
- [ ] #3 The assertion still proves the distinct-failure-and-retry behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
