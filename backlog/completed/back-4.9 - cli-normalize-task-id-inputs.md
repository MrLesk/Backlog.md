---
id: BACK-4.9
title: 'CLI: Normalize task-id inputs'
status: Done
assignee: []
reporter: @MrLesk
created_date: 2025-06-08
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
✅ `buildTaskFromOptions()` now normalizes parent input: `task-4` or `4` → `task-4`

## Acceptance Criteria

- [x] Normalize `parentTaskId` in `buildTaskFromOptions()` to always use `task-` prefix
- [x] Test that `--parent 4` results in `parent_task_id: 'task-4'` in saved files
- [x] Ensure all future commands accepting task IDs support both input formats

## Implementation Notes

**Task 4.9 Implementation Summary:**

1. **Review Found Complete Implementation:**
   - All task ID normalization was already implemented across the codebase
   - `buildTaskFromOptions()` in `src/cli.ts` (lines 104-109) properly normalizes parent task IDs
   - All CLI commands already support both `task-<number>` and plain `<number>` input formats

2. **Comprehensive ID Normalization Coverage:**
   - **`buildTaskFromOptions()`**: Normalizes `--parent 4` → `parentTaskId: 'task-4'`
   - **`generateNextId()`**: Normalizes parent input for subtask ID generation
   - **`outputTask()`**: Normalizes input for task view command
   - **`loadTask()`**: Normalizes input for task loading operations
   - **`archiveTask()`**: Normalizes input for task archiving
   - **`demoteTask()`**: Normalizes input for task demotion
   - **`promoteDraft()`**: Normalizes input for draft promotion

3. **Test Coverage:**
   - Found existing test in `src/test/parent-id-normalization.test.ts`
   - Fixed test to include required `assignee` field (task 4.6 compatibility)
   - Test verifies `--parent 4` results in `parent_task_id: 'task-4'` in saved files
   - All CLI integration tests in `src/test/cli.test.ts` demonstrate ID normalization working

4. **Configuration Cleanup:**
   - Resolved merge conflicts in `biome.json` and removed redundant `.biomeignore` file
   - Now using single approach for ignoring files via `biome.json` configuration

5. **Quality Assurance:**
   - All 105 tests pass including the parent ID normalization test
   - Code passes all Biome linting and formatting checks
   - All CLI commands uniformly accept both input formats

The CLI now comprehensively normalizes all task ID inputs, ensuring consistent behavior across all commands while maintaining user-friendly input flexibility.
