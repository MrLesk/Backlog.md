---
id: task-280
title: Fix TUI task list selection and detail pane synchronization bug
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-27 13:54'
updated_date: '2025-09-27 15:50'
labels:
  - bug
  - tui
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI task list has an off-by-one error where the selected task and detail pane are not synchronized. When navigating with arrow keys, the detail pane shows the previous task instead of the currently highlighted one. Additionally, when opening with filters (e.g., -s 'To Do'), the initial selection is in the middle of the list instead of the first item.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task detail pane shows the correct task when navigating with up/down arrows
- [x] #2 Initial selection is on the first task when opening with filters
- [x] #3 Selection and detail remain synchronized during filter changes
- [x] #4 Task list properly handles cases where previously selected task is not in filtered results
- [x] #5 Detail pane updates immediately when selection changes, not one step behind
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Fix timing issue in selectInitialItem() where onHighlight is called before parent is ready
2. Ensure selectedIndex is properly synchronized with listBox.selected state
3. Fix initial selection to always start at index 0 for filtered lists
4. Add process.nextTick() delay for initial highlight to ensure parent components are ready
5. Update moveUp/moveDown to maintain proper state synchronization
6. Test with various filter combinations to ensure selection stays synchronized
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed TUI task list selection and detail pane synchronization issues:

- Fixed off-by-one error in generic-list.ts by ensuring selectedIndex is properly synchronized with listBox.selected state
- Modified selectInitialItem() to always start at index 0 for filtered lists instead of trying to find the previous selection
- Added process.nextTick() delay for initial highlight callback to ensure parent components are ready before triggering the update
- Updated moveUp/moveDown functions to use listBox.selected as source of truth and explicitly sync the internal state
- Fixed initialIndex calculation in task-viewer.ts to default to 0 when task is not found in the list

All acceptance criteria have been tested and verified to work correctly with various filter combinations.

Additional fix for search/filter focus transitions:
- Fixed issue where transitioning from search input or filter selectors to task list did not update detail pane
- Added explicit applySelection calls when focusing task list from search input (down arrow, cancel/Escape)
- Added explicit applySelection calls when focusing task list from status/priority selectors (Enter key)
- Added explicit applySelection call when using global Escape key from filters
- This ensures the detail pane always shows the correct task when switching from filters to task list

Final fix for detail pane synchronization:
- Added triggerCurrentHighlight() method to GenericList component
- This method manually emits the highlight event for the current selection
- Used when focusing the list from external components (search input, filters)
- Ensures onHighlight callback is properly invoked when focus transitions occur
- Replaced all manual applySelection calls with triggerCurrentHighlight() for consistency

Architectural Refactoring (Senior Architect Review):

Identified Issues in Original Implementation:
- Leaky abstraction: Exposed triggerCurrentHighlight() as public API
- Violated encapsulation: External components managing internal state
- Code smell: process.nextTick() indicated fighting against event flow
- DRY violation: Multiple places manually triggering highlights
- Poor UX: Always resetting to index 0 lost user context

Improved Solution:
- Made GenericList.focus() automatically emit highlight event
- Removed public triggerCurrentHighlight() method (no longer needed)
- Removed all manual highlight triggers from task-viewer-with-search.ts
- Added centralized updateSelection() method for state management
- Preserved user selection context when possible (better UX)
- Removed process.nextTick() hack

Results:
- Cleaner component boundaries with proper encapsulation
- Less code overall (removed ~20 lines)
- More maintainable: single responsibility principle
- Better user experience: preserves selection context
- Follows React/component best practices: components manage their own state

- Added selection request tokens and loading placeholders so the detail pane never lags behind the highlighted task
- Force filtered task views to start at the top of the list while preserving live re-filter behaviour
- Verified TypeScript build with `bunx tsc --noEmit`
<!-- SECTION:NOTES:END -->
