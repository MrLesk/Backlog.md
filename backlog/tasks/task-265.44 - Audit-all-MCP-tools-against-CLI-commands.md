---
id: task-265.44
title: Comprehensive MCP audit for CLI parity and architectural compliance
status: To Do
assignee: []
created_date: '2025-09-23 14:04'
labels:
  - audit
  - mcp
  - cli-parity
  - architecture
dependencies: []
parent_task_id: task-265
priority: medium
---

## Description

Comprehensive audit of all MCP handlers to ensure CLI parity and architectural compliance, identifying violations and creating remediation plans.

## Scope
This consolidated audit combines two critical reviews:
1. **CLI Parity Audit**: Ensure every MCP tool matches corresponding CLI command exactly
2. **Architecture Compliance Audit**: Identify handlers that violate the "thin wrapper" principle

## Files to Audit

### MCP Handler Files
- `src/mcp/tools/task-handlers.ts`
- `src/mcp/tools/draft-handlers.ts`
- `src/mcp/tools/decision-handlers.ts`
- `src/mcp/tools/document-handlers.ts`
- `src/mcp/tools/notes-handlers.ts`
- `src/mcp/tools/board-tools.ts`
- `src/mcp/tools/config-tools.ts`
- `src/mcp/tools/dependency-tools.ts`
- `src/mcp/tools/sequence-tools.ts`
- `src/mcp/tools/project-overview-handlers.ts`

## Audit Categories

### 1. CLI Parity Audit
For each MCP tool, verify:
- **Command Mapping**: Does corresponding CLI command exist?
- **Parameter Alignment**: Do parameters match CLI exactly?
- **Validation Consistency**: Does validation logic match CLI?
- **Output Format**: Do responses align with CLI output?
- **Feature Scope**: Are there any MCP-only features to remove?

### 2. Architecture Compliance Audit
For each handler, identify:
- **Custom ID Generation** (should use Core's `generateNextId`)
- **Custom Validation Logic** (should use Core's validation)
- **Direct Filesystem Operations** (should use Core's fs methods)
- **Custom Business Logic** (should delegate to Core)
- **Reimplemented Core Functionality**

## Expected Violations

Based on initial analysis, likely violations include:
- Custom ID generation in decision/document handlers
- Direct filesystem access instead of Core methods
- Reimplemented validation logic
- Business logic that should be in Core
- Features that exceed CLI capabilities

## Deliverables

### 1. CLI Parity Report
- Comprehensive comparison matrix of MCP tools vs CLI commands
- List of MCP-only features requiring removal
- List of CLI features missing from MCP
- Parameter and validation discrepancies
- Output format inconsistencies

### 2. Architecture Compliance Report
- Documentation of all architectural violations found
- Specific violations by handler file
- Recommended refactoring approach for each violation
- Priority classification (critical/high/medium/low)

### 3. Remediation Plan
- Specific refactoring tasks for each violation found
- Dependencies and sequencing for fixes
- Architecture guidelines for future MCP development
- Review checklist for MCP changes

## Acceptance Criteria

### CLI Parity
- Every MCP tool maps to exactly one CLI command (or is removed)
- All parameters match CLI exactly (no extras, no missing)
- All validation logic matches CLI behavior
- All output formats align with CLI responses
- No MCP-exclusive features remain

### Architecture Compliance
- All MCP handlers follow "thin wrapper" principle
- No business logic duplicated between MCP and Core
- No custom ID generation in MCP handlers
- No direct filesystem operations in MCP
- All Core APIs used appropriately

### Process Improvements
- Architecture review checklist integrated into development workflow
- Clear guidelines documented for future MCP changes
- Automated tests prevent regression of violations
