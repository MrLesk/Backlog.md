---
id: task-265.31
title: Add task cleanup tool
status: Done
assignee: []
created_date: '2025-09-16T17:26:00.475Z'
updated_date: '2025-09-22 17:17'
labels:
  - mcp
  - tools
  - cleanup
  - maintenance
  - enhancement
dependencies:
  - task-265.24
parent_task_id: task-265
priority: low
---

## Description

Implement automated task cleanup functionality to help maintain project organization by archiving old completed tasks and managing project hygiene.
## Overview
The CLI has a `cleanup` command for moving old completed tasks to the archive, but this functionality is missing from the MCP server. Agents need automated cleanup capabilities to maintain project organization without manual intervention.

## Tool to Implement

### cleanup_tasks
- **Purpose**: Archive old completed tasks and maintain project organization
- **Parameters**:
  - olderThanDays (optional): Archive tasks completed more than N days ago (default: 30)
  - dryRun (optional): Show what would be cleaned without executing (default: false)
  - includeArchived (optional): Include already archived tasks in analysis (default: false)
  - statusFilter (optional): Only cleanup tasks with specific status (default: "done")
  - maxTasks (optional): Limit number of tasks to process (default: unlimited)
- **Returns**: Cleanup summary with processed tasks and results

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    olderThanDays: { type: "number", minimum: 1, maximum: 3650 },
    dryRun: { type: "boolean" },
    includeArchived: { type: "boolean" },
    statusFilter: { type: "string", maxLength: 50 },
    maxTasks: { type: "number", minimum: 1, maximum: 1000 }
  },
  required: []
}
```

### Cleanup Logic
1. **Task Discovery**: Find tasks matching cleanup criteria
2. **Age Calculation**: Check completion date vs threshold
3. **Safety Checks**: Verify tasks are safe to archive
4. **Batch Processing**: Process tasks in manageable batches
5. **Result Reporting**: Provide detailed operation summary

### Safety Features
- **Dependency Check**: Don't archive tasks with active dependents
- **Status Validation**: Only archive truly completed tasks
- **Backup Creation**: Optional backup before bulk operations
- **Rollback Support**: Ability to undo cleanup operations

### Response Structure
```typescript
{
  summary: {
    tasksAnalyzed: number,
    tasksArchived: number,
    tasksSkipped: number,
    errors: number
  },
  details: {
    archived: Array<{
      taskId: string,
      title: string,
      completedDate: string,
      archivePath: string
    }>,
    skipped: Array<{
      taskId: string,
      title: string,
      reason: string
    }>,
    errors: Array<{
      taskId: string,
      error: string
    }>
  },
  dryRun: boolean,
  executedAt: string
}
```

## Advanced Features
- **Smart Archiving**: Consider task importance and references
- **Batch Processing**: Handle large cleanup operations efficiently
- **Progress Reporting**: Status updates for long-running operations
- **Selective Cleanup**: Archive by project phase or milestone

## Use Cases for Agents
- **Automated Maintenance**: Regular project housekeeping
- **Sprint Cleanup**: Archive completed sprint tasks
- **Release Preparation**: Clean up before major releases
- **Storage Management**: Reduce active task list size
- **Performance Optimization**: Improve query performance

## Core Integration
- Use existing Core.cleanup() and archiveTask() methods
- Leverage task filtering and date utilities
- Integrate with filesystem operations
- Follow established error handling patterns

## Error Handling
- Handle filesystem permission issues
- Manage partial cleanup failures gracefully
- Provide detailed error reporting
- Support cleanup resumption after failures

## Testing Requirements
- Test cleanup with various age thresholds
- Test dry-run functionality without side effects
- Test safety checks (dependencies, status validation)
- Test batch processing with large task sets
- Test error scenarios and recovery
- Verify archive integrity after cleanup

## Overview
The CLI has a `cleanup` command for moving old completed tasks to the archive, but this functionality is missing from the MCP server. Agents need automated cleanup capabilities to maintain project organization without manual intervention.

## Tool to Implement

### cleanup_tasks
- **Purpose**: Archive old completed tasks and maintain project organization
- **Parameters**:
  - olderThanDays (optional): Archive tasks completed more than N days ago (default: 30)
  - dryRun (optional): Show what would be cleaned without executing (default: false)
  - includeArchived (optional): Include already archived tasks in analysis (default: false)
  - statusFilter (optional): Only cleanup tasks with specific status (default: "done")
  - maxTasks (optional): Limit number of tasks to process (default: unlimited)
- **Returns**: Cleanup summary with processed tasks and results

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    olderThanDays: { type: "number", minimum: 1, maximum: 3650 },
    dryRun: { type: "boolean" },
    includeArchived: { type: "boolean" },
    statusFilter: { type: "string", maxLength: 50 },
    maxTasks: { type: "number", minimum: 1, maximum: 1000 }
  },
  required: []
}
```

### Cleanup Logic
1. **Task Discovery**: Find tasks matching cleanup criteria
2. **Age Calculation**: Check completion date vs threshold
3. **Safety Checks**: Verify tasks are safe to archive
4. **Batch Processing**: Process tasks in manageable batches
5. **Result Reporting**: Provide detailed operation summary

### Safety Features
- **Dependency Check**: Don't archive tasks with active dependents
- **Status Validation**: Only archive truly completed tasks
- **Backup Creation**: Optional backup before bulk operations
- **Rollback Support**: Ability to undo cleanup operations

### Response Structure
```typescript
{
  summary: {
    tasksAnalyzed: number,
    tasksArchived: number,
    tasksSkipped: number,
    errors: number
  },
  details: {
    archived: Array<{
      taskId: string,
      title: string,
      completedDate: string,
      archivePath: string
    }>,
    skipped: Array<{
      taskId: string,
      title: string,
      reason: string
    }>,
    errors: Array<{
      taskId: string,
      error: string
    }>
  },
  dryRun: boolean,
  executedAt: string
}
```

## Advanced Features
- **Smart Archiving**: Consider task importance and references
- **Batch Processing**: Handle large cleanup operations efficiently
- **Progress Reporting**: Status updates for long-running operations
- **Selective Cleanup**: Archive by project phase or milestone

## Use Cases for Agents
- **Automated Maintenance**: Regular project housekeeping
- **Sprint Cleanup**: Archive completed sprint tasks
- **Release Preparation**: Clean up before major releases
- **Storage Management**: Reduce active task list size
- **Performance Optimization**: Improve query performance

## Core Integration
- Use existing Core.cleanup() and archiveTask() methods
- Leverage task filtering and date utilities
- Integrate with filesystem operations
- Follow established error handling patterns

## Error Handling
- Handle filesystem permission issues
- Manage partial cleanup failures gracefully
- Provide detailed error reporting
- Support cleanup resumption after failures

## Testing Requirements
- Test cleanup with various age thresholds
- Test dry-run functionality without side effects
- Test safety checks (dependencies, status validation)
- Test batch processing with large task sets
- Test error scenarios and recovery
- Verify archive integrity after cleanup

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Archives tasks older than specified threshold
- [ ] #2 Provides dry-run capability to preview changes
- [ ] #3 Includes safety checks for dependencies and status
- [ ] #4 Returns detailed summary of cleanup operations
- [ ] #5 Handles large cleanup operations efficiently
- [ ] #6 Integrates with existing Core cleanup methods
- [ ] #7 Supports configurable cleanup criteria
- [ ] #8 Comprehensive test coverage including error scenarios
<!-- AC:END -->

## Implementation Notes

Task completed with decision NOT to implement MCP cleanup tool based on security audit findings. 

## Resolution:
Task cleanup functionality will remain CLI-only due to unacceptable security risks for agent access:

### Security Concerns Identified:
1. **Destructive Operations**: Cleanup can permanently archive/delete tasks - too dangerous for automated agent access
2. **Authentication Gap**: No proper auth/authz framework for agents performing destructive operations
3. **Data Integrity Risk**: Potential for agents to corrupt dependencies or lose important data
4. **Audit/Rollback Issues**: Difficult to implement proper rollback for agent-initiated cleanup

### Decision:
✅ Keep cleanup as CLI-only tool where:
- Human operators maintain full control
- Operations are carefully reviewed before execution
- Proper authentication/authorization enforced
- Clear audit trails with accountability

This aligns with security best practices of keeping destructive operations under human control rather than exposing them to automated agents. The MCP integration will focus on safe, non-destructive operations only.
