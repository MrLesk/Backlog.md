---
id: task-260
title: 'Web UI: Add filtering to All Tasks view'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-07 19:42'
updated_date: '2025-09-13 21:03'
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


## Implementation Notes

Web UI All Tasks filtering implemented with comprehensive filter controls. Added status, priority, assignee, and text search filters with instant updates, URL state persistence, clear all functionality, and full test coverage. Clean UX that integrates perfectly with existing components.
