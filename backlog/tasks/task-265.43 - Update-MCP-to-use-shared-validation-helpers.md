---
id: task-265.43
title: Update MCP to use shared validation helpers
status: To Do
assignee: []
created_date: '2025-09-23 14:04'
labels:
  - mcp
  - refactor
  - validation
dependencies:
  - task-265.42
parent_task_id: task-265
priority: medium
---

## Description

Replace MCP duplicate validation logic with shared validation helpers from utils module.

Issue: MCP has its own implementations of validation functions that duplicate CLI logic, creating maintenance burden and potential inconsistency.

Changes Required:
1. Import shared helpers from src/utils/validation-helpers.ts
2. Replace MCP normalizeDependencies with shared version
3. Replace MCP validateDependencies with shared version
4. Delete duplicate validation code from MCP handlers

Files to Modify:
- src/mcp/tools/task-handlers.ts
- src/mcp/tools/dependency-tools.ts (remove duplicate validation)

Dependencies:
- Requires task-265.42 (extract validation helpers)

Pattern Change:
From: Custom MCP validation methods
To: Import and use shared validation helpers

Benefits:
- Identical validation behavior between CLI and MCP
- Single source of truth for validation rules
- Reduced code in MCP handlers
- Easier testing and maintenance

Acceptance Criteria:
- MCP imports and uses shared validation helpers
- No duplicate validation code remains in MCP
- Validation behavior matches CLI exactly
- All MCP validation tests continue to pass
