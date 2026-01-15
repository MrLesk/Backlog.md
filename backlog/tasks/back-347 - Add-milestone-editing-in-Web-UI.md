---
id: BACK-347
title: Add milestone editing in Web UI
status: To Do
assignee: []
created_date: '2025-12-17 19:29'
updated_date: '2025-12-17 22:11'
labels:
  - milestones
  - web-ui
  - enhancement
milestone: m-6
dependencies: []
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
Currently milestones can only be added from the Web UI. There's no way to rename a milestone or edit its details once created. Users have to manually edit config or use CLI/MCP tools.

### What
Add milestone editing capabilities to the Milestones page:
- Add an "Edit" button/icon on each milestone card
- Allow renaming milestones (with validation for duplicates)
- When renaming, update all tasks that reference the old milestone name
- Add ability to delete/remove a milestone (with confirmation)
- When deleting, option to reassign tasks to another milestone or leave unassigned

### Related
- task-344 added MCP milestone management (list/add/rename/remove)
- Should reuse the same core logic for consistency
<!-- SECTION:DESCRIPTION:END -->
