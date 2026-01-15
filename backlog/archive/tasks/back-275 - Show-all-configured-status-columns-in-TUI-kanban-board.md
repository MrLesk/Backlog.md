---
id: BACK-275
title: Show all configured status columns in TUI kanban board
status: To Do
assignee: []
created_date: '2025-09-26 19:06'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI kanban board currently only displays columns for statuses that have tasks, hiding empty status columns. This is inconsistent with the web UI which shows all configured statuses regardless of task presence. Empty columns need to be visible for users to understand the full workflow and to enable dragging tasks to empty statuses. The TUI should read the configured statuses from the project configuration and display all columns, showing "No tasks in [Status]" for empty ones, matching the web UI behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read configured statuses from backlog.yml config
- [ ] #2 Update prepareBoardColumns to include all configured statuses
- [ ] #3 Ensure empty columns display with 'No tasks in [Status]' message
- [ ] #4 Maintain proper column width distribution for all columns
- [ ] #5 Preserve existing task sorting and grouping logic
- [ ] #6 Test with various status configurations including custom statuses
<!-- AC:END -->
