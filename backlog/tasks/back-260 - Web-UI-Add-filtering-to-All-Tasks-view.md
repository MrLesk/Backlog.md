---
id: BACK-260
title: 'Web UI: Add filtering to All Tasks view'
status: To Do
assignee:
  - '@codex'
created_date: '2025-09-07 19:42'
updated_date: '2026-05-17 20:20'
labels:
  - web-ui
  - filters
  - ui
milestone: m-8
dependencies: []
references:
  - BACK-420
priority: medium
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add filter controls to the All Tasks page to quickly narrow the list by common fields (status, priority, text). Provide instant updates, a way to clear filters, and persist state in the URL so filters survive navigation/reload.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Status filter lists statuses from backlog/config.yml and filters tasks
- [ ] #2 Priority filter lists high, medium, low and filters tasks
- [ ] #3 Text search filters by title and description
- [ ] #4 Filters combine with AND semantics and update the list instantly
- [ ] #5 Clear all filters resets to showing all tasks
- [ ] #6 Filter state persists in URL query parameters and restores on reload
- [ ] #7 Type-check and lint pass; filtering logic has tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
BACK-420 (Add task content TOC and scrollspy) is a sub-concern of this ticket. Consider implementing together or tracking BACK-420 as a sub-item — both operate on the same task content view in All Tasks.
<!-- SECTION:NOTES:END -->
