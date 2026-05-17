---
id: BACK-492.6
title: Extract parseMultiParam helper for server query params
status: To Do
assignee: []
created_date: '2026-05-17 21:12'
labels:
  - tech-debt
  - refactoring
milestone: m-13
dependencies:
  - BACK-492.1
modified_files:
  - src/server/index.ts
parent_task_id: BACK-492
priority: low
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both `handleListTasks` and `handleSearch` in `src/server/index.ts` contain identical boilerplate for collecting multi-value query params: `getAll(singular) + getAll(plural) + CSV split + trim + filter`. This pattern appears three times for `label`/`labels`, `assignee`/`assignees`, and `modifiedFile`/`modifiedFiles`, across two methods.

Extracting a `parseMultiParam(url, ...keys)` helper eliminates the duplication and provides one place to fix normalization (e.g. coordinating with BACK-492.01 on label lowercasing).

**Implementation plan:**
1. Add module-local `parseMultiParam(url: URL, ...keys: string[]): string[]` at the top of `src/server/index.ts`; it merges all `getAll(key)` results, splits any CSV values, trims, and filters empty strings
2. Replace all 5–6 inline instances in `handleListTasks` and `handleSearch` with calls to the helper
3. Ensure label params pass through `labelsToLower()` (or handle inside the helper with an optional normalizer arg)
4. Note: coordinate with BACK-492.01 to avoid double-fixing the label case issue
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 parseMultiParam helper exists and is used in both handleListTasks and handleSearch
- [ ] #2 label, assignee, and modifiedFile params all use the helper
- [ ] #3 All existing server tests pass
- [ ] #4 No duplication remains between the two methods for param parsing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
