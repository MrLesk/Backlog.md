---
id: task-265.38
title: Fix MCP task handler to use Core generateNextId
status: To Do
assignee: []
created_date: '2025-09-23 14:03'
labels:
  - mcp
  - bug-fix
  - id-generation
dependencies:
  - task-274
parent_task_id: task-265
priority: high
---

## Description

Replace custom ID generation in MCP task handler with Core API to fix sub-task numbering.

Issue: MCP task handler reimplements ID generation (lines 83-89 in task-handlers.ts) instead of using Core's generateNextId method, causing sub-task numbering issues.

Changes Required:
1. Delete lines 83-89 in src/mcp/tools/task-handlers.ts
2. Replace with: const newId = await this.server.generateNextId(parentTaskId)
3. Remove task counting and manual ID construction logic

Files to Modify:
- src/mcp/tools/task-handlers.ts (createTask method)

Dependencies:
- Requires task-274 (Core createTaskFromData fix) to be completed first

Benefits:
- Fixes sub-task numbering (task-265.01, task-265.02 format)
- Uses same ID generation logic as CLI
- Eliminates code duplication
- Supports distributed ID generation from git branches

Acceptance Criteria:
- MCP task creation uses Core generateNextId method
- Sub-tasks created with proper task-XXX.YY format when parentTaskId provided
- Regular tasks use task-XXX format when no parent
- ID generation matches CLI behavior exactly
