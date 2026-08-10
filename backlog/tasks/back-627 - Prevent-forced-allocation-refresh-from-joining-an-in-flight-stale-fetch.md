---
id: BACK-627
title: Prevent forced allocation refresh from joining an in-flight stale fetch
status: To Do
assignee: []
created_date: '2026-08-10 06:37'
labels: []
dependencies: []
priority: medium
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the PR #899 (BACK-624) verification round. The task-ID allocation path now forces a remote-ref refresh past the 60s lease, but a forced refresh arriving while a non-forced fetch is already in flight joins that fetch (src/core/backlog.ts:581-599 — the force flag never starts a second fetch; GitOperations.fetch also coalesces per-remote at src/git/operations.ts:572-586). A push landing during the in-flight fetch is invisible to the allocation, so a duplicate numeric ID is possible in a window equal to the remaining fetch duration (typically under 2s, capped at 10s), requiring push-during-fetch plus a concurrent allocation. Fix direction validated by the reviewer: the force path should await the in-flight refresh and then run one more fetch if that refresh began before the force request. The existing regression test (src/test/core-task-corpus-regressions.test.ts, allocation case) completes its push before allocation starts, so it does not cover this race; add one that does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A forced allocation refresh that arrives during an in-flight non-forced fetch observes refs at least as fresh as the moment the force was requested
- [ ] #2 A regression test covers the push-during-in-flight-fetch allocation race and fails on the current code
- [ ] #3 No extra fetch is issued when no refresh is in flight (existing single-fetch assertion still passes)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
