---
id: task-265.32
title: Implement batch task update tool
status: To Do
assignee: []
created_date: '2025-09-16T17:26:26.048Z'
labels:
  - mcp
  - tools
  - batch
  - bulk-operations
  - enhancement
dependencies:
  - task-268
parent_task_id: task-265
priority: low
---

## Description

Add batch operation capabilities to enable agents to update multiple tasks simultaneously with filtering, validation, and atomic operations.

## Overview
The MCP server currently only supports individual task updates, but agents often need to perform bulk operations like updating status across multiple tasks, bulk label changes, or mass assignee updates. This tool provides efficient batch processing with safety features.

## Tool to Implement

### task_batch_update
- **Purpose**: Update multiple tasks simultaneously with filtering and validation
- **Parameters**:
  - filter (required): Criteria for selecting tasks to update
  - updates (required): Changes to apply to selected tasks
  - dryRun (optional): Preview changes without executing (default: false)
  - atomic (optional): All-or-nothing operation (default: true)
  - maxTasks (optional): Safety limit on number of tasks (default: 100)
- **Returns**: Batch operation results with success/failure details

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    filter: {
      type: "object",
      properties: {
        status: { type: "string", maxLength: 50 },
        assignee: { type: "string", maxLength: 100 },
        labels: { type: "array", items: { type: "string" } },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        taskIds: { type: "array", items: { type: "string" } },
        createdAfter: { type: "string", format: "date" },
        createdBefore: { type: "string", format: "date" }
      }
    },
    updates: {
      type: "object",
      properties: {
        status: { type: "string", maxLength: 100 },
        assignee: { type: "array", items: { type: "string" } },
        addLabels: { type: "array", items: { type: "string" } },
        removeLabels: { type: "array", items: { type: "string" } },
        priority: { type: "string", enum: ["high", "medium", "low"] }
      }
    },
    dryRun: { type: "boolean" },
    atomic: { type: "boolean" },
    maxTasks: { type: "number", minimum: 1, maximum: 500 }
  },
  required: ["filter", "updates"]
}
```

### Filtering Logic
- **Status Filter**: Tasks with specific status
- **Assignee Filter**: Tasks assigned to specific users
- **Label Filter**: Tasks with specific labels (AND/OR logic)
- **Priority Filter**: Tasks with specific priority
- **ID Filter**: Explicit list of task IDs
- **Date Range**: Tasks created within date range

### Update Operations
- **Status Change**: Bulk status updates (e.g., "In Progress" → "Done")
- **Assignee Updates**: Bulk assignment changes
- **Label Management**: Add/remove labels from multiple tasks
- **Priority Updates**: Bulk priority adjustments
- **Custom Fields**: Support for additional metadata updates

### Safety Features
- **Preview Mode**: Dry-run shows intended changes without executing
- **Atomic Operations**: All updates succeed or all fail
- **Validation**: Verify all updates are valid before executing
- **Limits**: Configurable limits to prevent accidental mass operations

### Response Structure
```typescript
{
  summary: {
    tasksMatched: number,
    tasksUpdated: number,
    tasksFailed: number,
    operationTime: number
  },
  results: Array<{
    taskId: string,
    title: string,
    success: boolean,
    changes?: Record<string, any>,
    error?: string
  }>,
  dryRun: boolean,
  atomic: boolean,
  executedAt: string
}
```

## Use Cases for Agents
- **Sprint Transitions**: Move all tasks from "In Progress" to "Done"
- **Assignee Changes**: Reassign tasks during team changes
- **Label Management**: Add project tags to related tasks
- **Priority Adjustments**: Bulk priority updates for releases
- **Status Synchronization**: Align task status with external systems

## Advanced Features
- **Transaction Support**: Rollback on partial failures
- **Progress Reporting**: Status updates for large operations
- **Conditional Updates**: Updates based on current task state
- **Audit Trail**: Track batch operation history

## Error Handling
- Validate all tasks exist before batch operation
- Handle individual task update failures gracefully
- Provide detailed error reporting per task
- Support partial success with detailed reporting

## Testing Requirements
- Test various filter combinations
- Test different update operations
- Test atomic vs non-atomic operations
- Test dry-run functionality
- Test error scenarios and rollback
- Test performance with large task sets
- Verify safety limits work correctly

## Overview
The MCP server currently only supports individual task updates, but agents often need to perform bulk operations like updating status across multiple tasks, bulk label changes, or mass assignee updates. This tool provides efficient batch processing with safety features.

## Tool to Implement

### task_batch_update
- **Purpose**: Update multiple tasks simultaneously with filtering and validation
- **Parameters**:
  - filter (required): Criteria for selecting tasks to update
  - updates (required): Changes to apply to selected tasks
  - dryRun (optional): Preview changes without executing (default: false)
  - atomic (optional): All-or-nothing operation (default: true)
  - maxTasks (optional): Safety limit on number of tasks (default: 100)
- **Returns**: Batch operation results with success/failure details

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    filter: {
      type: "object",
      properties: {
        status: { type: "string", maxLength: 50 },
        assignee: { type: "string", maxLength: 100 },
        labels: { type: "array", items: { type: "string" } },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        taskIds: { type: "array", items: { type: "string" } },
        createdAfter: { type: "string", format: "date" },
        createdBefore: { type: "string", format: "date" }
      }
    },
    updates: {
      type: "object",
      properties: {
        status: { type: "string", maxLength: 100 },
        assignee: { type: "array", items: { type: "string" } },
        addLabels: { type: "array", items: { type: "string" } },
        removeLabels: { type: "array", items: { type: "string" } },
        priority: { type: "string", enum: ["high", "medium", "low"] }
      }
    },
    dryRun: { type: "boolean" },
    atomic: { type: "boolean" },
    maxTasks: { type: "number", minimum: 1, maximum: 500 }
  },
  required: ["filter", "updates"]
}
```

### Filtering Logic
- **Status Filter**: Tasks with specific status
- **Assignee Filter**: Tasks assigned to specific users
- **Label Filter**: Tasks with specific labels (AND/OR logic)
- **Priority Filter**: Tasks with specific priority
- **ID Filter**: Explicit list of task IDs
- **Date Range**: Tasks created within date range

### Update Operations
- **Status Change**: Bulk status updates (e.g., "In Progress" → "Done")
- **Assignee Updates**: Bulk assignment changes
- **Label Management**: Add/remove labels from multiple tasks
- **Priority Updates**: Bulk priority adjustments
- **Custom Fields**: Support for additional metadata updates

### Safety Features
- **Preview Mode**: Dry-run shows intended changes without executing
- **Atomic Operations**: All updates succeed or all fail
- **Validation**: Verify all updates are valid before executing
- **Limits**: Configurable limits to prevent accidental mass operations

### Response Structure
```typescript
{
  summary: {
    tasksMatched: number,
    tasksUpdated: number,
    tasksFailed: number,
    operationTime: number
  },
  results: Array<{
    taskId: string,
    title: string,
    success: boolean,
    changes?: Record<string, any>,
    error?: string
  }>,
  dryRun: boolean,
  atomic: boolean,
  executedAt: string
}
```

## Use Cases for Agents
- **Sprint Transitions**: Move all tasks from "In Progress" to "Done"
- **Assignee Changes**: Reassign tasks during team changes
- **Label Management**: Add project tags to related tasks
- **Priority Adjustments**: Bulk priority updates for releases
- **Status Synchronization**: Align task status with external systems

## Advanced Features
- **Transaction Support**: Rollback on partial failures
- **Progress Reporting**: Status updates for large operations
- **Conditional Updates**: Updates based on current task state
- **Audit Trail**: Track batch operation history

## Error Handling
- Validate all tasks exist before batch operation
- Handle individual task update failures gracefully
- Provide detailed error reporting per task
- Support partial success with detailed reporting

## Testing Requirements
- Test various filter combinations
- Test different update operations
- Test atomic vs non-atomic operations
- Test dry-run functionality
- Test error scenarios and rollback
- Test performance with large task sets
- Verify safety limits work correctly

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Supports complex filtering to select target tasks
- [ ] #2 Can perform various update operations (status, assignee, labels, priority)
- [ ] #3 Provides dry-run capability to preview changes
- [ ] #4 Supports atomic operations (all-or-nothing)
- [ ] #5 Includes safety limits to prevent accidental mass operations
- [ ] #6 Returns detailed results for each task operation
- [ ] #7 Handles errors gracefully with proper reporting
- [ ] #8 Comprehensive test coverage for all batch scenarios
<!-- AC:END -->
