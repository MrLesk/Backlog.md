---
id: task-265
title: >-
  Web UI: Enhance all tasks view with in-progress highlighting and done tasks
  toggle
status: Done
assignee:
  - '@web-ui-agent'
created_date: '2025-09-13 18:05'
updated_date: '2025-09-13 18:23'
labels:
  - ui
  - enhancement
dependencies: []
---

## Description

Improve the all tasks view in the web UI to make in-progress tasks visually distinct and add a toggle filter to show/hide done tasks (hidden by default)

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In-progress tasks are visually distinguished from other tasks in the all tasks view
- [x] #2 Toggle filter for done tasks is added to the UI
- [x] #3 Done tasks are hidden by default when the page loads
- [x] #4 Toggle state persists during the session
- [x] #5 Visual indicators are accessible and work with different themes/color schemes
<!-- AC:END -->


## Implementation Plan

1. Enhance task card styling to visually distinguish in-progress tasks
2. Add prominent visual indicators (border, background, etc.) for in-progress status
3. Create a toggle control for showing/hiding done tasks
4. Implement sessionStorage persistence for toggle state
5. Hide done tasks by default when page loads
6. Ensure accessibility with proper ARIA labels and color contrast
7. Test with different themes and color schemes
8. Verify toggle state persists during session but resets on new session


## Implementation Notes

## Implementation Summary

### Features Implemented
- **In-Progress Task Highlighting**: Tasks with "In Progress" status now have:
  - Blue border (2px instead of default 1px)
  - Light blue background tint (bg-blue-50/50 in light mode, bg-blue-900/20 in dark mode)
  - Enhanced visual distinction from other task cards
- **Done Tasks Toggle**: Checkbox control to show/hide completed tasks
  - Hidden by default when page loads
  - Labeled "Show done tasks" with proper accessibility
  - Positioned in the filter controls section
- **Session Persistence**: Toggle state preserved using sessionStorage
  - Persists during browser session but resets on new session
  - Automatically restores state on page load

### Technical Implementation
- Enhanced `getTaskCardClasses()` function for dynamic styling
- Added `showDoneTasks` state with sessionStorage integration
- Used `useMemo` for efficient task filtering
- Implemented proper ARIA labels for accessibility
- Dark mode compatible styling using Tailwind CSS utilities

### Visual Design
- In-progress tasks use blue theme colors (border-blue-500, bg-blue-50/50)
- Maintains existing hover states and transitions
- Accessible color contrast ratios for both light and dark themes
- Consistent with existing design system

### Files Modified
- `/src/web/components/TaskList.tsx` - Main component with visual enhancements
- `/src/test/web-task-filtering.test.ts` - Tests include done task toggle logic

### Verification
- All acceptance criteria marked complete ✓
- In-progress tasks visually distinct ✓
- Done tasks hidden by default ✓
- Toggle state persists during session ✓
- Accessibility and theme compatibility ✓
