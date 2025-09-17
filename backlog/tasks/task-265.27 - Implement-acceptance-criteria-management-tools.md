---
id: task-265.27
title: Implement acceptance criteria management tools
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-16T17:24:16.134Z'
updated_date: '2025-09-17 17:24'
labels:
  - mcp
  - tools
  - acceptance-criteria
  - enhancement
dependencies:
  - task-265.24
parent_task_id: task-265
priority: medium
---

## Description

Add comprehensive acceptance criteria (AC) management tools to enable agents to add, remove, check, and uncheck acceptance criteria items on tasks.
## Overview
The CLI supports detailed AC management (`--ac`, `--remove-ac`, `--check-ac`, `--uncheck-ac`) but the MCP server lacks these granular operations. Agents need to manage AC items individually for proper task tracking and completion verification.

## Tool to Implement

### task_acceptance_criteria
- **Purpose**: Manage acceptance criteria items with multiple operations
- **Parameters**:
  - taskId (required): Target task identifier
  - operation (required): "add" | "remove" | "check" | "uncheck" | "list"
  - criteria (optional): AC text for add operation
  - index (optional): 1-based index for remove/check/uncheck operations
  - indices (optional): Array of indices for batch operations
- **Returns**: Updated task with modified AC list
- **Operations**:
  - add: Append new AC item
  - remove: Remove AC by index
  - check: Mark AC as completed
  - uncheck: Mark AC as incomplete
  - list: Get all AC with status

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 },
    operation: { 
      type: "string", 
      enum: ["add", "remove", "check", "uncheck", "list"] 
    },
    criteria: { type: "string", maxLength: 500 },
    index: { type: "number", minimum: 1 },
    indices: { 
      type: "array", 
      items: { type: "number", minimum: 1 },
      maxItems: 20 
    }
  },
  required: ["taskId", "operation"]
}
```

### Operation Logic
- **add**: Requires `criteria` parameter, appends to AC array
- **remove**: Requires `index` or `indices`, removes specified items
- **check/uncheck**: Requires `index` or `indices`, toggles completion status
- **list**: Returns all AC with checked/unchecked status

### Core Integration
- Use existing task update mechanisms
- Preserve AC order and formatting
- Maintain compatibility with existing AC structure
- Support both individual and batch operations

### Response Format
```typescript
{
  taskId: string,
  operation: string,
  acceptanceCriteria: Array<{
    text: string,
    checked: boolean,
    index: number
  }>,
  success: boolean,
  message?: string
}
```

## Use Cases
- Add new requirements discovered during development
- Remove obsolete or invalid criteria
- Track progress by checking completed criteria
- Batch operations for efficiency
- Query current AC status for reporting

## Error Handling
- Validate task exists before AC operations
- Check index bounds for remove/check/uncheck
- Prevent duplicate criteria addition
- Handle empty AC arrays gracefully

## Testing Requirements
- Test all 5 operations (add, remove, check, uncheck, list)
- Test batch operations with multiple indices
- Test error cases (invalid task, out-of-bounds index)
- Test AC preservation during operations
- Verify proper checked/unchecked status management

## Overview
The CLI supports detailed AC management (`--ac`, `--remove-ac`, `--check-ac`, `--uncheck-ac`) but the MCP server lacks these granular operations. Agents need to manage AC items individually for proper task tracking and completion verification.

## Tool to Implement

### task_acceptance_criteria
- **Purpose**: Manage acceptance criteria items with multiple operations
- **Parameters**:
  - taskId (required): Target task identifier
  - operation (required): "add" | "remove" | "check" | "uncheck" | "list"
  - criteria (optional): AC text for add operation
  - index (optional): 1-based index for remove/check/uncheck operations
  - indices (optional): Array of indices for batch operations
- **Returns**: Updated task with modified AC list
- **Operations**:
  - add: Append new AC item
  - remove: Remove AC by index
  - check: Mark AC as completed
  - uncheck: Mark AC as incomplete
  - list: Get all AC with status

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 },
    operation: { 
      type: "string", 
      enum: ["add", "remove", "check", "uncheck", "list"] 
    },
    criteria: { type: "string", maxLength: 500 },
    index: { type: "number", minimum: 1 },
    indices: { 
      type: "array", 
      items: { type: "number", minimum: 1 },
      maxItems: 20 
    }
  },
  required: ["taskId", "operation"]
}
```

### Operation Logic
- **add**: Requires `criteria` parameter, appends to AC array
- **remove**: Requires `index` or `indices`, removes specified items
- **check/uncheck**: Requires `index` or `indices`, toggles completion status
- **list**: Returns all AC with checked/unchecked status

### Core Integration
- Use existing task update mechanisms
- Preserve AC order and formatting
- Maintain compatibility with existing AC structure
- Support both individual and batch operations

### Response Format
```typescript
{
  taskId: string,
  operation: string,
  acceptanceCriteria: Array<{
    text: string,
    checked: boolean,
    index: number
  }>,
  success: boolean,
  message?: string
}
```

## Use Cases
- Add new requirements discovered during development
- Remove obsolete or invalid criteria
- Track progress by checking completed criteria
- Batch operations for efficiency
- Query current AC status for reporting

## Error Handling
- Validate task exists before AC operations
- Check index bounds for remove/check/uncheck
- Prevent duplicate criteria addition
- Handle empty AC arrays gracefully

## Testing Requirements
- Test all 5 operations (add, remove, check, uncheck, list)
- Test batch operations with multiple indices
- Test error cases (invalid task, out-of-bounds index)
- Test AC preservation during operations
- Verify proper checked/unchecked status management

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Can add new acceptance criteria to tasks
- [x] #2 Can remove AC by index (1-based)
- [x] #3 Can check/uncheck AC items to track completion
- [x] #4 Supports batch operations for multiple indices
- [x] #5 List operation returns all AC with status
- [x] #6 Proper validation prevents invalid operations
- [x] #7 Maintains AC order and formatting
- [x] #8 Comprehensive test coverage for all operations
<!-- AC:END -->


## Implementation Plan

## Implementation Plan

### Technical Analysis
Leveraging existing AcceptanceCriteriaManager in src/core/acceptance-criteria.ts with established MCP framework patterns.

### Implementation Phases
**Phase 3A: MCP Tool Schemas**
- Add criteria_add, criteria_remove, criteria_check, criteria_list schemas in src/mcp/tools/task-tools.ts
- Implement proper input validation (AC #6)

**Phase 3B: MCP Handlers** 
- Bridge MCP calls to AcceptanceCriteriaManager methods in src/mcp/tools/task-handlers.ts
- Support batch operations for multiple indices (AC #1-5)

**Phase 3C: Tool Registration**
- Register new AC tools with MCP server

**Phase 3D: Testing**
- Comprehensive test coverage for all operations (AC #8)
- Unit tests, integration tests, edge cases, batch operations

### Technical Decisions
- Reuse existing AcceptanceCriteriaManager for consistency
- 1-based indexing for user-friendly operations
- Support both single and batch operations
- Maintain AC order and formatting (AC #7)

### Files to Modify
1. src/mcp/tools/task-tools.ts - AC tool schemas
2. src/mcp/tools/task-handlers.ts - AC handlers
3. src/mcp/tools/task-handlers.test.ts - Tests
4. MCP server init - Tool registration
