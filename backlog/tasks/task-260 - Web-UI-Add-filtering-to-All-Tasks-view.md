---
id: task-260
title: 'Web UI: Add filtering to All Tasks view'
status: Done
assignee:
  - '@web-ui-agent'
created_date: '2025-09-07 19:42'
updated_date: '2025-09-13 18:23'
labels:
  - web-ui
  - filters
  - ui
dependencies: []
priority: medium
---

## Description

Add filter controls to the All Tasks page to quickly narrow the list by common fields (status, priority, text). Provide instant updates, a way to clear filters, and persist state in the URL so filters survive navigation/reload.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status filter lists statuses from backlog/config.yml and filters tasks
- [x] #2 Priority filter lists high, medium, low and filters tasks
- [x] #3 Text search filters by title and description
- [x] #4 Filters combine with AND semantics and update the list instantly
- [x] #5 Clear all filters resets to showing all tasks
- [x] #6 Filter state persists in URL query parameters and restores on reload
- [x] #7 Type-check and lint pass; filtering logic has tests
<!-- AC:END -->


## Implementation Plan

1. Analyze current TaskList.tsx structure and state management
2. Add filter state with React hooks (useState) for status, priority, text search
3. Create filter UI components above the task list
4. Fetch statuses from config.yml via API
5. Implement filtering logic with AND semantics
6. Add URL query parameter persistence using URLSearchParams
7. Implement clear all filters functionality
8. Test filtering works correctly and persists on reload


## Implementation Notes

## Implementation Summary

### Features Implemented
- **Status Filter**: Dynamically loads statuses from backlog/config.yml via API
- **Priority Filter**: Hardcoded high/medium/low options with proper capitalization
- **Text Search**: Searches both task title and description with case-insensitive matching
- **Filter Combination**: All filters use AND logic and update instantly as user types/selects
- **Clear Filters**: Button appears when any filter is active to reset all filters at once
- **URL Persistence**: Filter state saved to and restored from URL query parameters

### Technical Implementation
- Added React hooks (useState, useEffect, useMemo) for state management
- Used URLSearchParams API for URL manipulation
- Implemented proper TypeScript interfaces for type safety
- Created comprehensive test suite with 9 test cases covering all filtering scenarios
- Filter UI uses responsive flex layout with proper accessibility labels

### Files Modified
- `/src/web/components/TaskList.tsx` - Main component with filtering logic
- `/src/test/web-task-filtering.test.ts` - New test file with comprehensive coverage

### Verification
- All acceptance criteria marked complete ✓
- Type checking passes ✓
- Tests pass (9/9) ✓
- Browser testing confirms functionality works ✓
