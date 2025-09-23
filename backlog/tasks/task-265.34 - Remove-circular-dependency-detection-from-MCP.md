---
id: task-265.34
title: Remove circular dependency detection from MCP
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

Delete the unauthorized circular dependency detection feature from MCP that does not exist in CLI.

Issue: MCP has a detectCircularDependency method (350+ lines) in src/mcp/tools/dependency-tools.ts that provides functionality the CLI does not have. This violates the principle that MCP should be a pure wrapper.

Changes Required:
1. Delete method: Remove detectCircularDependency entirely
2. Remove calls: Remove all calls to this method from add/remove dependency operations  
3. Update validation: Keep only basic validation that matches CLI behavior

Files to Modify:
- src/mcp/tools/dependency-tools.ts - Remove detectCircularDependency method
- Remove any references to circular dependency checking in MCP handlers

Acceptance Criteria:
- MCP no longer checks for circular dependencies
- Dependency validation matches CLI exactly  
- No business logic that CLI does not have
- Tests pass without circular dependency detection
