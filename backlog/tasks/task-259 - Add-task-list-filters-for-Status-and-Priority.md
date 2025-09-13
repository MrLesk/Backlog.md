---
id: task-259
title: Add task list filters for Status and Priority
status: Done
assignee:
  - '@tui-filters-agent'
created_date: '2025-09-06 23:39'
updated_date: '2025-09-13 18:24'
labels:
  - tui
  - filters
  - ui
dependencies: []
priority: medium
---

## Description

Add two filter selectors in the Task List view:

- Status filter: choose from configured statuses (To Do, In Progress, Done or custom)
- Priority filter: choose from high, medium, low

The filters should be accessible from the task list pane and update the list immediately. Keep controls minimal to match the simplified footer.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status filter is available in the task list and lists statuses from backlog/config.yml
- [x] #2 Priority filter is available in the task list and lists: high, medium, low
- [x] #3 Applying a filter updates the task list immediately and can be cleared to show all tasks
- [x] #4 Filters persist during the current TUI session and reset on exit
- [x] #5 Works alongside existing navigation; minimal footer remains uncluttered
- [x] #6 Tests cover filtering logic for status and priority; type-check and lint pass
<!-- AC:END -->


## Implementation Plan

1. Analyze current TUI task list implementation to understand structure
2. Create filter UI components for status and priority selection
3. Implement filter state management and persistence during session
4. Add filtering logic that works with existing task loading
5. Update task list view to show filter controls
6. Test filtering functionality and edge cases
7. Write comprehensive tests for filter logic
8. Ensure type-checking and linting pass


## Implementation Notes

Implemented task list filters for Status and Priority in TUI:

**Key Changes:**
- Enhanced task-viewer.ts with filter state management and UI
- Added filter status display above task list showing active filters and count
- Implemented status filter with options from backlog/config.yml
- Implemented priority filter with high/medium/low options
- Added keyboard shortcuts: S for status filter, P for priority filter
- Filters update task list immediately with live selection
- Filter state persists during TUI session (resets on exit)
- Maintained minimal footer design with filter shortcuts

**Technical Implementation:**
- Created TaskFilters interface for type safety
- Added applyFilters() function for filter logic
- Used genericSelectList for filter selection UI
- Updated task list positioning to accommodate filter status display
- Fixed parameter assignment linting issues
- Added comprehensive test coverage in tui-task-filtering.test.ts

**UI/UX:**
- Filter status shows active filters and task count (e.g., "Filters: Status: In Progress • 5/23 tasks")
- Clear filter options available in selection dialogs
- Keyboard shortcuts integrated into help bar
- Smooth interaction with existing task navigation

**Testing:**
- Created 9 comprehensive tests covering all filter combinations
- Tests include edge cases like undefined priority and empty results
- All tests pass successfully
- TypeScript compilation and linting pass
