---
id: task-265.37
title: Remove caching from MCP project overview
status: To Do
assignee: []
created_date: '2025-09-23 14:03'
labels:
  - mcp
  - architecture
  - feature-removal
dependencies: []
parent_task_id: task-265
priority: medium
---

## Description

Remove unauthorized caching implementation from MCP project overview handler.

Issue: MCP project overview handler implements caching with TTL and cache management that the CLI overview command does not have.

Features to Remove:
1. Cache management system (TTL, hash generation)
2. Cache invalidation logic
3. Cached response serving
4. All caching-related state and methods

Files to Modify:
- src/mcp/tools/project-overview-handlers.ts (remove caching implementation)

Reasoning:
- CLI overview command does not cache results
- Caching belongs in Core layer if needed, not MCP
- MCP should have identical performance characteristics to CLI

Acceptance Criteria:
- No caching logic remains in MCP project overview
- Performance matches CLI overview command
- Project overview always returns fresh data
- Code simplified without cache complexity
