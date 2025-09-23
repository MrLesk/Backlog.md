---
id: task-265.40
title: Refactor all MCP entity creation to use Core APIs
status: To Do
assignee: []
created_date: '2025-09-23 14:03'
labels:
  - mcp
  - refactor
  - core-api
dependencies:
  - task-265.53
  - task-265.38
parent_task_id: task-265
priority: high
---

## Description

Comprehensive refactoring to ensure all MCP entity creation (tasks, drafts, sub-tasks) uses Core APIs exclusively, eliminating duplicate business logic and ensuring CLI parity.

## Scope
This task consolidates multiple related refactoring efforts:
1. **Task Creation**: Replace manual task construction with Core's createTaskFromData
2. **Draft Promotion**: Replace 50+ lines of custom logic with Core's promoteDraft API
3. **Sub-task Numbering**: Fix MCP to use Core's generateNextId for proper sub-task numbering
4. **API Consistency**: Ensure all MCP creation operations match CLI behavior exactly

## Current Issues
- MCP task handler manually constructs task objects instead of using createTaskFromData
- MCP draft promotion reimplements 50+ lines of business logic
- MCP ignores parentTaskId parameter for sub-task numbering
- Inconsistent behavior between MCP and CLI operations

## Implementation Requirements

### 1. Task Creation Refactoring
**File**: `src/mcp/tools/task-handlers.ts` (lines 83-89)
- Replace manual ID generation with Core's `generateNextId(parentTaskId)`
- Replace manual task construction with `createTaskFromData()`
- Ensure proper sub-task numbering when parentTaskId provided

### 2. Draft Promotion Refactoring
**File**: `src/mcp/tools/draft-handlers.ts`
- Replace 50+ lines of custom promotion logic
- Use: `await this.server.promoteDraft(draftId, false)`
- Remove manual task construction and status changes

### 3. Draft Creation Refactoring
**File**: `src/mcp/tools/draft-handlers.ts` (lines 24-30)
- Replace manual draft construction with Core's `createDraft()` API
- Ensure consistent behavior with CLI draft creation

## Files to Modify
- `src/mcp/tools/task-handlers.ts` - Task creation methods
- `src/mcp/tools/draft-handlers.ts` - Draft creation and promotion methods

## Pattern Changes

### Before (Task Creation)
```typescript
const tasks = await this.server.fs.listTasks();
const highestId = tasks.reduce(...);
const newId = `task-${highestId + 1}`;
const task = new Task(newId, title, ...);
```

### After (Task Creation)
```typescript
const task = await this.server.createTaskFromData({
  title, description, parentTaskId, // ... other fields
}, false);
```

### Before (Draft Promotion)
```typescript
// 50+ lines of custom business logic
const tasks = await this.server.fs.listTasks();
// manual task construction, validation, etc.
```

### After (Draft Promotion)
```typescript
const promotedTask = await this.server.promoteDraft(draftId, false);
```

## Dependencies
- Requires task-265.53 (Core createTaskFromData fix for sub-task numbering)
- Requires task-265.38 (MCP ID generation fix)

## Acceptance Criteria

### Task Creation
- MCP task creation uses `createTaskFromData()` exclusively
- Sub-tasks created with proper task-###.## format when parentTaskId provided
- Regular tasks use task-### format when no parentTaskId
- MCP and CLI produce identical task objects for same inputs

### Draft Operations
- Draft creation uses Core's `createDraft()` API
- Draft promotion uses Core's `promoteDraft()` API exclusively
- No custom business logic in MCP draft handlers
- MCP and CLI draft operations produce identical results

### Code Quality
- No custom ID generation in MCP handlers
- No manual task/draft object construction
- All existing MCP tests pass
- New tests verify MCP/CLI parity for all operations

### Benefits Achieved
- Eliminates 100+ lines of duplicate business logic
- Ensures consistent validation between MCP and CLI
- Automatic handling of dates, defaults, and edge cases
- Single source of truth for entity creation logic
