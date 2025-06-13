---
id: task-52
title: 'CLI: Filter tasks list by status or assignee'
status: Done
assignee:
  - '@codex'
created_date: '2025-06-13'
updated_date: '2025-06-13'
labels: []
dependencies: []
---

## Description

Add filtering options to task list command

## Acceptance Criteria
- [x] `backlog task list --status "To Do"` filters by status
- [x] `backlog task list --assignee user` filters by assignee

## Implementation Notes

### Key Changes Made

1. **CLI Options Added** (`src/cli.ts:253-254`)
   - Added `-s, --status <status>` option to filter tasks by status
   - Added `-a, --assignee <assignee>` option to filter tasks by assignee
   - Both options can be used independently or together

2. **Filtering Logic** (`src/cli.ts:262-268`)
   - Implemented filter logic after loading all tasks from filesystem
   - Status filter: Exact match comparison with `task.status`
   - Assignee filter: Checks if assignee array includes the specified user
   - Filters are applied sequentially if both options are provided

3. **User Experience**
   - Maintains existing behavior when no filters are specified
   - Shows "No tasks found." message when filters return empty results
   - Works with both `--plain` text output and interactive UI modes
   - Preserves grouping by status and respects configured status order

4. **Test Coverage** (`src/test/cli.test.ts:265-339`)
   - Added test for filtering by status: Creates tasks with different statuses and verifies filtered output
   - Added test for filtering by assignee: Creates tasks with different assignees and verifies filtered output
   - Tests use the CLI directly via `Bun.spawnSync` to ensure end-to-end functionality

### Technical Details

The implementation follows the existing CLI pattern:
- Options are parsed by Commander.js
- Core filtering happens in the action handler before display
- No changes to Core API or filesystem layer were needed
- Backward compatible - existing commands work unchanged
