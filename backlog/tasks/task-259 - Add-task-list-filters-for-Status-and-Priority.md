---
id: task-259
title: Add task list filters for Status and Priority
status: Done
assignee:
  - '@agent259'
created_date: '2025-09-06 23:39'
updated_date: '2025-09-13 20:20'
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

1. Extend TaskListFilter interface to include priority\n2. Update FileSystem.listTasks() to support priority filtering\n3. Add filter UI components to task-viewer using blessed boxes/lists\n4. Integrate filters with existing GenericList component\n5. Add filter state management to ViewSwitcher\n6. Implement filter controls with keyboard shortcuts\n7. Add tests for filtering logic\n8. Run type-check and lint to ensure compliance


## Implementation Notes

TUI task list filters implemented successfully. Added interactive filter panel with F key toggle, status/priority dropdowns, proper state management, and comprehensive test coverage. Integrates seamlessly with existing TUI architecture.
