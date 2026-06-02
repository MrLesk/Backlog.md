---
id: BACK-486
title: 'Add filters to drafts page'
status: Done
assignee: []
created_date: '2026-05-23 15:10'
updated_date: '2026-05-23 15:18'
labels:
  - web-ui
  - drafts
  - filtering
  - ux
dependencies:
  - BACK-485
priority: medium
ordinal: 33300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rewrote `DraftsList.tsx` to add a full filter bar and keyword search, matching the Task List and Milestones page designs.

**Filter controls** (left side of the bar):
- **Keyword search** — text input with search icon and clear button; filters drafts by ID or title (substring match, case-insensitive). Synced to URL via `?q=...`.
- **Status filter** — dropdown of all available statuses
- **Priority filter** — dropdown (All / High / Medium / Low)
- **Milestone filter** — dropdown of active milestones + "No milestone" option
- **Label filter** — multi-select chip input (`LabelFilterDropdown`) with autocomplete

**Filter bar right side**:
- **"Clear filters" button** — appears only when any filter (including search) is active; resets all filters and clears URL params
- **Result counter** — `Showing X / Y drafts` (localized)

**Empty state**:
- When no drafts exist: shows "No drafts" with description
- When filters yield zero results: shows "No drafts match your filters" with suggestion to adjust or clear filters

**Technical details**:
- All filtering is client-side (`useMemo`) against the loaded drafts array
- Filter state is synced to URL query params (`?status=...&priority=...&milestone=...&label=...&q=...`) via `useSearchParams`
- Removed unused `archivedMilestones` prop from `DraftsList` and `App.tsx`
- Added localization keys: `drafts.showingCount`, `drafts.noDraftsMatchFilters`, `drafts.tryAdjustingFilters`, `drafts.searchPlaceholder`
- Cleaned up duplicate localization keys from `taskDetails` namespace in all 4 locale files
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Drafts page displays a filter bar with Status, Priority, Milestone, and Label controls matching the Task List design
- [x] #2 Each filter control uses the same dropdown / chip-input components and styling as Task List
- [x] #3 Filters are applied client-side against the loaded drafts array
- [x] #4 Result counter shows "Showing X / Y drafts" (localized) on the right side of the filter bar
- [x] #5 Filter state is synced to URL query params (`?status=...&priority=...&milestone=...&label=...&q=...`) so the view is shareable
- [x] #6 A "Clear filters" button appears when any filter is active, resetting all filters and removing query params
- [x] #7 Empty state adapts to active filters: "No drafts match your filters" with suggestion to clear filters
- [x] #8 Draft cards continue to display correctly when filters reduce the result set to zero
- [x] #9 All changes pass type-checking and linting
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Study TaskList filter implementation**
   - Read `src/web/components/TaskList.tsx` lines ~88–300 to understand state management, URL sync, and filter logic.
   - Note the `useSearchParams` hook usage for query-param persistence.
   - Note the `LabelFilterDropdown` or `ChipInput` components used for label filtering.

2. **Extract reusable filter bar (optional but recommended)**
   - If TaskList filters are tightly coupled to the table, extract a `TaskFilterBar` component that accepts:
     - `tasks: Task[]`
     - `availableStatuses: string[]`
     - `milestoneEntities: Milestone[]`
     - `archivedMilestones: Milestone[]`
     - `onFilterChange: (filtered: Task[]) => void`
   - Reuse this component in both TaskList and DraftsList.
   - Alternatively, copy the filter state logic into DraftsList if extraction is too invasive.

3. **Add filter state to DraftsList**
   - Import `useSearchParams` from `react-router-dom`.
   - Add `statusFilter`, `priorityFilter`, `milestoneFilter`, `labelFilter` state variables initialized from query params.
   - Derive `filteredDrafts` with `useMemo` applying all active filters.

4. **Render filter UI**
   - Place the filter bar between the page header and the draft cards list.
   - Reuse existing dropdown components for status / priority / milestone.
   - Reuse the label chip-input component.

5. **Empty states & polish**
   - Update the empty-state message when filters are active.
   - Add a localized result counter.
   - Ensure dark-mode styles are consistent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Rewrote `DraftsList.tsx` with client-side filtering using `useSearchParams` for URL sync.
- Added Status, Priority, Milestone, and Label filter controls matching TaskList design.
- Added result counter `t.drafts.showingCount` and "Clear filters" button with visibility toggle.
- Empty state adapts to active filters with `t.drafts.noDraftsMatchFilters` / `t.drafts.tryAdjustingFilters`.
- Removed unused `archivedMilestones` prop from `DraftsList` and `App.tsx`.
- Fixed localization keys in `en.ts`, `zh-CN.ts`, `zh-TW.ts`, `ja.ts` — removed duplicate `showingCount`/`noDraftsMatchFilters`/`tryAdjustingFilters` from `taskDetails` namespace.
- Fixed pre-existing TS errors in `PathAutocomplete.tsx` (unused `onSubmit` and `prefix`).
- Added keyword search input to the left of the status filter, matching MilestonesPage design (search icon, clear button, substring match on draft ID and title). Search state synced to URL via `?q=...` param.
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
