---
id: task-265.36
title: Remove document filtering and pagination from MCP
status: To Do
assignee: []
created_date: '2025-09-23 14:02'
labels:
  - mcp
  - architecture
  - feature-removal
dependencies: []
parent_task_id: task-265
priority: medium
---

## Description

Remove unauthorized document filtering and pagination features from MCP that CLI does not support.

Issue: MCP document handlers provide type/tag filtering and pagination features that the CLI document commands do not have.

Features to Remove:
1. Document filtering by type parameter
2. Document filtering by tags parameter  
3. Pagination with offset/limit parameters
4. Document preview/summary generation
5. Any filtering logic beyond simple listing

Files to Modify:
- src/mcp/tools/document-handlers.ts (remove filtering logic lines 76-99)

Keep Only:
- Simple document listing (like CLI)
- Basic document creation/retrieval
- No additional query parameters

Acceptance Criteria:
- MCP document operations match CLI exactly
- No filtering or pagination features remain
- Document listing shows all documents (no filtering)
- API simplified to match CLI capabilities
