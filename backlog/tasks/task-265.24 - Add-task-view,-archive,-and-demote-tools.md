---
id: task-265.24
title: 'Add task view, archive, and demote tools'
status: "\U0001F4CB Ready"
assignee: []
created_date: '2025-09-16T17:22:46.621Z'
labels:
  - mcp
  - tools
  - tasks
  - enhancement
dependencies:
  - task-266
parent_task_id: task-265
priority: high
---

## Description

Expand MCP task management capabilities with essential operations that agents need for complete task lifecycle management.

## Current Gap
The MCP server has task_create, task_list, and task_update, but is missing key operations available in the CLI:
- `task view <taskId>` - Get detailed task information
- `task archive <taskId>` - Archive completed tasks  
- `task demote <taskId>` - Move task back to drafts

## Tools to Implement

### 1. task_view
- **Purpose**: Get complete task details including all metadata
- **Parameters**: taskId (required)
- **Returns**: Full task object with:
  - Basic info (title, description, status, assignee, labels, priority)
  - Metadata (created date, updated date, ordinal)
  - Implementation details (notes, plan)
  - Acceptance criteria (with checked status)
  - Dependencies
  - Parent task relationship
- **Usage**: Allows agents to inspect tasks in detail before making changes

### 2. task_archive
- **Purpose**: Move completed tasks to the archive/completed folder
- **Parameters**: taskId (required)
- **Returns**: Success confirmation and new file location
- **Validation**: Should verify task is in "Done" status before archiving
- **Implementation**: Uses existing Core.archiveTask() method
- **Usage**: Keep active task list clean by archiving finished work

### 3. task_demote
- **Purpose**: Convert a task back to a draft
- **Parameters**: taskId (required)  
- **Returns**: New draft ID and confirmation
- **Implementation**: Uses existing Core.demoteTask() method
- **Usage**: Handle cases where tasks need to be reconsidered or redesigned

## Implementation Details

### File Structure
- Add tools to existing `/src/mcp/tools/task-tools.ts`
- Update `/src/mcp/tools/task-handlers.ts` with new handlers
- Add tests to `/src/mcp/__tests__/unit/task-tools.test.ts`

### Schema Definitions
```typescript
// task_view schema
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 }
  },
  required: ["taskId"]
}

// task_archive schema (same as task_view)
// task_demote schema (same as task_view)
```

### Integration Points
- Leverage existing Core class methods: archiveTask(), demoteTask()
- Follow established error handling patterns
- Use consistent response formats with other task tools

## Testing Requirements
- Test successful operations with valid task IDs
- Test error handling for non-existent tasks
- Test validation (e.g., archiving non-completed tasks)
- Test edge cases and proper file system operations

## Current Gap
The MCP server has task_create, task_list, and task_update, but is missing key operations available in the CLI:
- `task view <taskId>` - Get detailed task information
- `task archive <taskId>` - Archive completed tasks  
- `task demote <taskId>` - Move task back to drafts

## Tools to Implement

### 1. task_view
- **Purpose**: Get complete task details including all metadata
- **Parameters**: taskId (required)
- **Returns**: Full task object with:
  - Basic info (title, description, status, assignee, labels, priority)
  - Metadata (created date, updated date, ordinal)
  - Implementation details (notes, plan)
  - Acceptance criteria (with checked status)
  - Dependencies
  - Parent task relationship
- **Usage**: Allows agents to inspect tasks in detail before making changes

### 2. task_archive
- **Purpose**: Move completed tasks to the archive/completed folder
- **Parameters**: taskId (required)
- **Returns**: Success confirmation and new file location
- **Validation**: Should verify task is in "Done" status before archiving
- **Implementation**: Uses existing Core.archiveTask() method
- **Usage**: Keep active task list clean by archiving finished work

### 3. task_demote
- **Purpose**: Convert a task back to a draft
- **Parameters**: taskId (required)  
- **Returns**: New draft ID and confirmation
- **Implementation**: Uses existing Core.demoteTask() method
- **Usage**: Handle cases where tasks need to be reconsidered or redesigned

## Implementation Details

### File Structure
- Add tools to existing `/src/mcp/tools/task-tools.ts`
- Update `/src/mcp/tools/task-handlers.ts` with new handlers
- Add tests to `/src/mcp/__tests__/unit/task-tools.test.ts`

### Schema Definitions
```typescript
// task_view schema
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 }
  },
  required: ["taskId"]
}

// task_archive schema (same as task_view)
// task_demote schema (same as task_view)
```

### Integration Points
- Leverage existing Core class methods: archiveTask(), demoteTask()
- Follow established error handling patterns
- Use consistent response formats with other task tools

## Testing Requirements
- Test successful operations with valid task IDs
- Test error handling for non-existent tasks
- Test validation (e.g., archiving non-completed tasks)
- Test edge cases and proper file system operations

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task_view returns complete task details including all metadata and relationships
- [ ] #2 task_archive successfully moves completed tasks to archive folder
- [ ] #3 task_demote converts tasks back to drafts
- [ ] #4 Proper validation prevents archiving non-completed tasks
- [ ] #5 Error handling for non-existent task IDs
- [ ] #6 All tools follow existing MCP response format patterns
- [ ] #7 Comprehensive test coverage for all three operations
<!-- AC:END -->
