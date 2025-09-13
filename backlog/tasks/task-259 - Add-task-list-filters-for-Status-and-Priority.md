---
id: task-259
title: Add task list filters for Status and Priority
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-06 23:39'
updated_date: '2025-09-13 19:30'
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
- [ ] #1 Status filter is available in the task list and lists statuses from backlog/config.yml
- [ ] #2 Priority filter is available in the task list and lists: high, medium, low
- [ ] #3 Applying a filter updates the task list immediately and can be cleared to show all tasks
- [ ] #4 Filters persist during the current TUI session and reset on exit
- [ ] #5 Works alongside existing navigation; minimal footer remains uncluttered
- [ ] #6 Tests cover filtering logic for status and priority; type-check and lint pass
<!-- AC:END -->
