---
id: BACK-400
title: Add Milestone Filter to TUI Board
status: Done
assignee: []
created_date: '2026-02-25 09:00'
labels:
  - tui
  - filter
  - milestone
  - enhancement
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Added milestone filtering capability to the TUI board (accessed via `backlog board`). The filter header now includes a milestone dropdown between priority and labels. Users can press `m` to activate the milestone filter, which filters tasks by their milestone assignment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run `backlog board` and press Tab to switch to board view
- [ ] #2 Press `m` to test milestone filter - dropdown should appear with all milestones
- [ ] #3 Select a milestone and verify tasks are filtered correctly
- [ ] #4 Press Tab to verify milestone filter is in the rotation
- [ ] #5 Check help bar shows `[m] Milestone`
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary
Successfully implemented milestone filtering for the TUI board feature.

## Changes Made
1. **src/ui/components/filter-header.ts**
   - Added `milestone` field to `FilterState` interface
   - Added `availableMilestones` to `FilterHeaderOptions` 
   - Added milestone to filter items (between priority and labels)
   - Added `focusMilestone()` method and milestone selector UI

2. **src/ui/task-viewer-with-search.ts**
   - Added `milestoneFilter` state variable
   - Passed milestone entities to filter header
   - Added milestone to filter change handler and `applyFilters()`
   - Added `m` keyboard shortcut for milestone filter
   - Updated help bar to show `[m] Milestone`

## Testing
- TypeScript compilation passes
- Linting passes
- UI tests not available (no test files in src/ui)
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
