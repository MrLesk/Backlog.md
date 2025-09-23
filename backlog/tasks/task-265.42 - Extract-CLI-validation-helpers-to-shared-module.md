---
id: task-265.42
title: Extract CLI validation helpers to shared module
status: To Do
assignee: []
created_date: '2025-09-23 14:04'
labels:
  - refactor
  - validation
  - shared-code
dependencies: []
parent_task_id: task-265
priority: medium
---

## Description

Create shared validation module to eliminate duplication between CLI and MCP.

Issue: Both CLI and MCP have separate implementations of validation logic (validateDependencies, normalizeDependencies), violating DRY principle.

Changes Required:
1. Create new file: src/utils/validation-helpers.ts
2. Move validateDependencies function from CLI
3. Move normalizeDependencies function from CLI  
4. Export functions for reuse by both CLI and MCP

Functions to Extract:
- validateDependencies(dependencies, core) -> ValidationResult
- normalizeDependencies(dependencies) -> string[]
- Any other validation helpers used by both

Files to Create:
- src/utils/validation-helpers.ts

Files to Modify:
- src/cli.ts (import from shared module)

Benefits:
- Single source of truth for validation logic
- Ensures CLI and MCP use identical validation
- Easier to maintain and test validation rules
- Reduces code duplication

Acceptance Criteria:
- Shared validation module created with extracted functions
- Functions handle all edge cases from original implementations
- TypeScript types properly exported
- No duplicate validation logic between CLI and MCP
- CLI continues to work with shared validation helpers
