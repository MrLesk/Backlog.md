---
id: BACK-492.2
title: Unify task filter logic behind a shared interface
status: To Do
assignee: []
created_date: '2026-05-17 21:12'
labels:
  - tech-debt
  - refactoring
milestone: m-13
dependencies: []
modified_files:
  - src/core/backlog.ts
  - src/core/search-service.ts
  - src/utils/task-search.ts
parent_task_id: BACK-492
priority: medium
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`Core.applyTaskFilters` (`src/core/backlog.ts:230`) and `SearchService.applyTaskFilters` (`src/core/search-service.ts:317`) implement independent filter passes on different types (`Task[]` vs `TaskSearchEntity[]`). Filter capabilities have already drifted: Core supports `milestone` and `parentTaskId`; SearchService supports `modifiedFiles`. Any new filter field must be added twice, and gaps go unnoticed.

The goal is a shared `TaskFilterSpec` interface that both paths accept, eliminating silent divergence.

**Implementation plan:**
1. Define `TaskFilterSpec` interface in `src/utils/task-search.ts` (or new `src/utils/filter-spec.ts`) capturing all filter fields both currently use
2. Refactor `Core.applyTaskFilters` to accept `TaskFilterSpec`; verify all callers pass compatible objects
3. Refactor `SearchService.normalizeFilters` to produce a `TaskFilterSpec`-compatible normalized form
4. Document intentional divergence (pre-normalized entity vs raw Task) in a comment
5. Add tests: milestone filter works in search path; modifiedFiles filter works in Core path
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Single TaskFilterSpec type used by both filter paths
- [ ] #2 Core.applyTaskFilters and SearchService.applyTaskFilters share the same field set (milestone, parentTaskId, modifiedFiles, status, assignee, priority, labels all present in both)
- [ ] #3 Test: milestone filter works through SearchService.search()
- [ ] #4 Test: modifiedFiles filter works through Core.queryTasks()
- [ ] #5 No existing filter tests broken
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
