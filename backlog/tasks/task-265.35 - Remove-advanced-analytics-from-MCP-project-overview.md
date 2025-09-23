---
id: task-265.35
title: Remove advanced analytics from MCP project overview
status: To Do
assignee: []
created_date: '2025-09-23 14:02'
labels:
  - mcp
  - architecture
  - feature-removal
dependencies: []
parent_task_id: task-265
priority: high
---

## Description

Remove unauthorized advanced analytics features from MCP project overview that CLI overview command does not provide.

Issue: MCP project overview handler has extensive analytics features (velocity, trends, quality metrics) that the CLI overview command does not have. This violates MCP wrapper principle.

Features to Remove:
1. Velocity calculations and trends
2. Quality metrics analysis
3. Advanced timeframe analysis
4. Team performance metrics
5. Any analytics beyond basic task counts

Files to Modify:
- src/mcp/tools/project-overview-handlers.ts
- src/mcp/tools/project-overview-tool.ts

Keep Only:
- Basic task statistics that CLI overview shows
- Simple task counts by status
- Basic project health metrics

Acceptance Criteria:
- MCP project overview provides same data as CLI overview command
- No advanced analytics features remain
- Response format simplified to match CLI capabilities
