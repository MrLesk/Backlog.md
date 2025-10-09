---
id: task-285
title: adjust z-index tooltip style
status: To Do
assignee: []
created_date: '2025-10-09 04:58'
updated_date: '2025-10-09 05:05'
labels: []
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the sidebar is collapsed, react-tooltip are hidden by elements in the main view.

- Kanban Board: Behind `task` card
- All Tasks: Behind Search input
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In `Kanban Board` page, tooltips are displayed over the `task` cards
- [ ] #2 In `All Tasks` page, tooltips are displayed over the Search input
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
apply `z-index: 10` to sidebar
<!-- SECTION:PLAN:END -->
