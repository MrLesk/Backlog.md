---
id: task-265.24
title: 'Add task view, archive, and demote tools'
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-16T17:22:46.621Z'
updated_date: '2025-09-17 00:01'
labels:
  - mcp
  - tools
  - tasks
  - enhancement
dependencies:
  - task-265.22
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


## Implementation Plan

Implementation Plan:

Step 1: Add Tool Schemas (/src/mcp/tools/task-tools.ts)
- Add task_view schema: Returns complete task details including metadata and relationships
- Add task_archive schema: Moves completed tasks to archive folder  
- Add task_demote schema: Converts tasks back to drafts
- Follow existing parameter validation patterns (taskId as required string)

Step 2: Implement Handler Methods (/src/mcp/tools/task-handlers.ts)
- Add handleTaskView(): Call core.filesystem.loadTask(taskId) and return full task object
- Add handleTaskArchive(): Validate task status is "Done", then call core.archiveTask(taskId)
- Add handleTaskDemote(): Call core.demoteTask(taskId) to convert to draft
- Implement proper error handling for non-existent task IDs
- Follow existing MCP response format patterns

Step 3: Register Tools (registerTaskTools function)
- Register all three new tools in the tools array
- Ensure proper tool name mapping to handlers

Step 4: Add Comprehensive Tests (/src/test/mcp-server.test.ts)
- Test successful operations with valid task IDs
- Test error handling for non-existent tasks
- Test validation (archiving non-completed tasks should fail)
- Test edge cases and response format consistency

Step 5: Validation & Quality Assurance
- Run all tests: bun test
- Type check: bunx tsc --noEmit  
- Lint and format: bun run check

Technical Decisions: Follow existing MCP patterns for consistency, use exact status matching for archive validation, leverage established validation wrapper patterns
