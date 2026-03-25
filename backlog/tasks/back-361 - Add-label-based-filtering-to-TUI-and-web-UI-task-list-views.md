---
id: BACK-361
title: Add label-based filtering to TUI and web UI task list views
status: To Do
assignee: []
created_date: '2026-01-15 20:15'
labels:
  - tui
  - web
  - enhancement
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to filter tasks by one or more labels in both the terminal UI (TUI) and web UI task list views. This enables quick narrowing of tasks when working with labeled workflows (e.g., "cli", "mcp", "bug").

Reuse the filtering patterns already established for status and priority filters, but adapt the UI/UX to handle label selection. Consider the limited footer space in TUI and how to present multiple label selections clearly without cluttering the interface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI task list view supports filtering by label(s)
- [ ] #2 Web UI task list view supports filtering by label(s)
- [ ] #3 Multiple labels can be selected (OR logic - show tasks matching any selected label)
- [ ] #4 Label filter integrates with existing status and priority filters (filters combine with AND logic)
- [ ] #5 Available labels are populated from current task set
- [ ] #6 Filter state is clearly displayed in the footer/UI without overwhelming limited space
- [ ] #7 Clearing label filter restores full task list
- [ ] #8 Filter patterns are consistent with existing status/priority filter implementation
<!-- AC:END -->
