---
id: task-265.27
title: Implement acceptance criteria management tools
status: To Do
assignee: []
created_date: '2025-09-16T17:24:16.134Z'
labels:
  - mcp
  - tools
  - acceptance-criteria
  - enhancement
dependencies:
  - task-268
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
- [ ] #1 Can add new acceptance criteria to tasks
- [ ] #2 Can remove AC by index (1-based)
- [ ] #3 Can check/uncheck AC items to track completion
- [ ] #4 Supports batch operations for multiple indices
- [ ] #5 List operation returns all AC with status
- [ ] #6 Proper validation prevents invalid operations
- [ ] #7 Maintains AC order and formatting
- [ ] #8 Comprehensive test coverage for all operations
<!-- AC:END -->
