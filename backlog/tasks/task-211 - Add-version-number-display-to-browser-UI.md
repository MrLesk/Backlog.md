---
id: task-211
title: Add version number display to browser UI
status: To Do
assignee: []
created_date: '2025-07-27'
labels:
  - ui
  - frontend
  - enhancement
dependencies: []
---

## Description

Add a subtle version number display to the browser UI for debugging purposes. The version should be displayed on the right side of the Settings item in the sidebar, so it's visible when the sidebar is expanded but hidden when collapsed. The version must come from the same embedded version that the CLI uses (backlog -v), not from package.json.

## Acceptance Criteria

- [ ] Version number is displayed on the right side of the Settings item in the sidebar
- [ ] Version text is small and muted (subtle gray color)
- [ ] Version format shows as 'v{version}' (e.g. v1.6.2)
- [ ] Version is only visible when sidebar is expanded (not shown when collapsed)
- [ ] Version number comes from the embedded version in the compiled binary (same as backlog -v)
- [ ] Body tag includes version as data attribute for easy inspection
- [ ] Version display does not interfere with user experience or UI elements
