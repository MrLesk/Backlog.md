---
id: task-265.53
title: Fix Core's createTaskFromData to handle sub-task creation
status: "📋 Ready"
assignee: []
created_date: '2025-09-23T13:36:48.794Z'
labels:
  - core
  - sub-tasks
  - bug-fix
dependencies: []
parent_task_id: task-265
priority: high
---

## Description

The Core's `createTaskFromData` method doesn't pass the parentTaskId to `generateNextId()`, preventing proper sub-task numbering.

## Current Issue
In `src/core/backlog.ts` line 238, `createTaskFromData` calls:
```typescript
const id = await this.generateNextId();
```

But it should pass the parentTaskId:
```typescript
const id = await this.generateNextId(taskData.parentTaskId);
```

## Impact
- Sub-tasks created through `createTaskFromData` don't get proper task-###.## numbering
- This affects both MCP and any future consumers of this Core API
- CLI works around this by calling `generateNextId` directly

## Fix Required
Change line 238 in `src/core/backlog.ts` from:
```typescript
const id = await this.generateNextId();
```
to:
```typescript
const id = await this.generateNextId(taskData.parentTaskId);
```

## Acceptance Criteria
- `createTaskFromData` properly generates sub-task IDs when parentTaskId is provided
- Existing tests continue to pass
- New test verifies sub-task creation works correctly

## Current Issue
In `src/core/backlog.ts` line 238, `createTaskFromData` calls:
```typescript
const id = await this.generateNextId();
```

But it should pass the parentTaskId:
```typescript
const id = await this.generateNextId(taskData.parentTaskId);
```

## Impact
- Sub-tasks created through `createTaskFromData` don't get proper task-###.## numbering
- This affects both MCP and any future consumers of this Core API
- CLI works around this by calling `generateNextId` directly

## Fix Required
Change line 238 in `src/core/backlog.ts` from:
```typescript
const id = await this.generateNextId();
```
to:
```typescript
const id = await this.generateNextId(taskData.parentTaskId);
```

## Acceptance Criteria
- `createTaskFromData` properly generates sub-task IDs when parentTaskId is provided
- Existing tests continue to pass
- New test verifies sub-task creation works correctly
