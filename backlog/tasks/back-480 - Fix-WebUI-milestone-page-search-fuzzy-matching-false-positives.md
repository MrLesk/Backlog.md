---
id: BACK-480
title: Fix WebUI milestone page search fuzzy matching false positives
status: Done
assignee: []
created_date: '2026-05-20 16:01'
updated_date: '2026-05-20 16:40'
labels:
  - web-ui
  - bug
priority: medium
ordinal: 26001
modified_files:
  - src/web/components/MilestonesPage.tsx
  - src/test/web-milestones-page-search.test.tsx
  - src/test/web-milestones-page-unassigned-filter.test.tsx
---

## Description

Milestone page search shows unrelated tasks when searching short numeric IDs. For example, searching `479` incorrectly includes `BACK-349`, `BACK-449`, `BACK-447`, `BACK-379` in results.

## Root Cause

Fuse.js threshold `0.35` is too lenient for short queries. A 3-character query like `479` against `349` produces edit distance = 1, score ≈ 0.33 < 0.35, causing false positive matches. The page only searches `task.id` and `task.title` without substring pre-filtering.

## Fix

Added substring containment matching before Fuse.js fallback in `MilestonesPage.tsx`:
1. Exact ID match
2. Substring match on `id` or `title`
3. Fuse.js fuzzy match (fallback only)

Also fixed unassigned section hiding done tasks during search, and added missing `I18nProvider` to milestone page tests.

## Implementation Plan

1. Add substring containment check (`id.includes(query) || title.includes(query)`) before Fuse.js search in `MilestonesPage.tsx`.
2. Fix unassigned section to show all matched tasks (including done) when search is active.
3. Wrap milestone page tests with `I18nProvider` and align assertion text with actual locale strings.
4. Add test case verifying substring search does not fuzzy-match unrelated IDs.

## Implementation Notes

**File:** `src/web/components/MilestonesPage.tsx`

- `visibleBuckets` memo now checks `substringMatches` after `exactIdMatches` and before falling back to Fuse.js.
- `renderUnassignedSection` uses `isSearchActive ? unassignedBucket.tasks : unassignedBucket.tasks.filter((task) => !isDoneStatus(task.status))` so done tasks are visible during search.

**File:** `src/test/web-milestones-page-search.test.tsx`

- Wrapped `<MemoryRouter>` with `<I18nProvider>` in `renderPage`.
- Updated assertion strings to match actual locale output (`Unassigned Tasks`, `No milestones match`, `Edit Milestone`, etc.).
- Added test: `searches by substring and does not fuzzy-match unrelated IDs`.

**File:** `src/test/web-milestones-page-unassigned-filter.test.tsx`

- Wrapped `<MemoryRouter>` with `<I18nProvider>` in `renderMilestonesPage`.
- Fixed regex case and empty-state assertion to match actual locale.

## Acceptance Criteria

- [x] Searching a numeric ID substring only matches tasks containing that substring in ID or title
- [x] Searching `101` does not fuzzy-match `202`, `303`, `404`
- [x] Milestone search tests pass with `I18nProvider`

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes.
- [x] #2 `bun run check .` passes.
- [x] #3 `bun test src/test/web-milestones-page-search.test.tsx src/test/web-milestones-page-unassigned-filter.test.tsx` passes.
<!-- DOD:END -->
