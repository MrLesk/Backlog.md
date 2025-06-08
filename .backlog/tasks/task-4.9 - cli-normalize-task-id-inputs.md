---
id: task-4.9
title: 'CLI: Normalize task-id inputs'
status: To Do
created_date: '2025-06-08'
labels:
  - cli
  - bug
dependencies: []
parent_task_id: task-4
---

## Description

Ensure parent task id uses task-<number> format and accept both forms across commands
Using `--parent 4` results in `parent_task_id: '4'` but should result in `parent_task_id: 'task-4'`, while other tasks expect the `task-<number>` prefix.

Update the CLI so that the parent ID is normalized to include the `task-` prefix when creating subtasks. All commands that accept a task ID should support both `task-<number>` and plain `<number>` inputs.

## Current Status
✅ `generateNextId()` already normalizes parent input: `task-4` or `4` → `task-4`  
✅ `outputTask()` (view command) already normalizes: `task-4` or `4` → `task-4`  
❌ `buildTaskFromOptions()` stores parent as-is without normalization

## Acceptance Criteria

- [ ] Normalize `parentTaskId` in `buildTaskFromOptions()` to always use `task-` prefix
- [ ] Test that `--parent 4` results in `parent_task_id: 'task-4'` in saved files
- [ ] Ensure all future commands accepting task IDs support both input formats
