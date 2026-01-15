---
id: BACK-362
title: Include completed tasks in MCP task_search results
status: To Do
assignee: []
created_date: '2026-01-15 20:22'
labels:
  - mcp
  - enhancement
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow MCP task_search to find completed tasks (from the completed folder) in addition to active tasks. This enables AI agents to discover historical work and context when searching.

Completed tasks should only appear in MCP search results - they should remain filtered out from task_list, TUI views, web UI views, and other interfaces where they would add noise to active task management.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MCP task_search includes completed tasks in search results
- [ ] #2 Completed tasks are clearly marked in search results (e.g., status shows 'Done' or includes completed indicator)
- [ ] #3 MCP task_list does NOT include completed tasks (current behavior preserved)
- [ ] #4 TUI and web UI task lists do NOT include completed tasks (current behavior preserved)
- [ ] #5 Search index includes both active and completed tasks for MCP context
<!-- AC:END -->
