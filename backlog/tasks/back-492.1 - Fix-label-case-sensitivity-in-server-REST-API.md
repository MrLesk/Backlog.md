---
id: BACK-492.1
title: Fix label case-sensitivity in server REST API
status: To Do
assignee: []
created_date: '2026-05-17 21:12'
labels:
  - bug
  - tech-debt
milestone: m-13
dependencies: []
modified_files:
  - src/server/index.ts
parent_task_id: BACK-492
priority: high
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`handleListTasks` (`src/server/index.ts:645`) and `handleSearch` (`src/server/index.ts:776`) normalize labels with `trim()` only, omitting `.toLowerCase()`. All other layers (Core, SearchService, TUI) use case-insensitive label matching. This means a REST client filtering `label=Bug` silently misses tasks tagged `bug` — a latent data inconsistency bug.

`normalizeLabel()` and `labelsToLower()` already exist in `src/utils/label-filter.ts` and do the right thing. Both server methods just don't call them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 handleListTasks label normalization replaced with labelsToLower() from utils/label-filter.ts
- [ ] #2 handleSearch label normalization replaced with labelsToLower() from utils/label-filter.ts
- [ ] #3 Test: filtering by label=BUG returns same results as label=bug via the REST API path
- [ ] #4 No new test failures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
