---
id: BACK-273.07
title: '273.07: Web UI status and priority filters on All Tasks view'
status: To Do
assignee: []
created_date: '2025-09-21 18:13'
updated_date: '2025-09-21 18:13'
labels:
  - web
  - ui
  - search
dependencies:
  - task-273.05
parent_task_id: task-273
priority: medium
---

## Description

Add status and priority filter dropdowns to the All Tasks view in the web UI, similar to the TUI implementation. These should connect to the centralized search service via the server endpoints established in task-273.05.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All Tasks view displays status filter dropdown with live filtering
- [ ] #2 All Tasks view displays priority filter dropdown with live filtering
- [ ] #3 Filters use the same status/priority values as CLI and TUI for consistency
- [ ] #4 Filter state is preserved when navigating between tasks and returning to All Tasks view
- [ ] #5 Filters work in combination (can filter by both status AND priority simultaneously)
- [ ] #6 Filter changes update the URL query parameters for bookmarkable filtered views
- [ ] #7 Clear/reset functionality to remove all active filters
- [ ] #8 Filtered task count is displayed (e.g., 'Showing 5 of 23 tasks')
<!-- AC:END -->
