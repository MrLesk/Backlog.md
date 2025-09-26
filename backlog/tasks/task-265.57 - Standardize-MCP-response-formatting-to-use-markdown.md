---
id: task-265.57
title: Standardize MCP response formatting to use markdown
status: To Do
assignee: []
created_date: '2025-09-26 16:07'
labels: []
dependencies: []
parent_task_id: task-265
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update all MCP tools to return consistent, human-readable markdown responses by leveraging existing CLI formatting functions instead of the current mix of plain text strings and JSON responses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All 25+ MCP tools return formatted markdown responses
- [ ] #2 Responses match CLI --plain output format
- [ ] #3 No JSON wrapping in response text
- [ ] #4 Existing formatting utilities are reused
- [ ] #5 All tools provide human-readable, structured output
<!-- AC:END -->
