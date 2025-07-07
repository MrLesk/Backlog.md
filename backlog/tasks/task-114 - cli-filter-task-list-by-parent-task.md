---
id: task-114
title: 'cli: filter task list by parent task'
status: Done
assignee: []
created_date: '2025-07-06'
updated_date: '2025-07-07'
labels: []
dependencies: []
---

## Description
Add a new feature to the `backlog task list` command that allows filtering tasks by their parent task ID using `--parent` or `-p` flags. It should display all tasks that have the specified task as their parent. Additionally, support a `--plain` flag to output the list in a plain, unformatted text.

## Acceptance Criteria

- [x] Add `--parent <task-id>` flag to `backlog task list` command
- [x] Add `-p <task-id>` flag to `backlog task list` command
- [x] Filter and display only tasks that have the specified parent task ID
- [x] Support `--plain` flag for unformatted output
- [x] Show appropriate message when no child tasks are found
- [x] Validate parent task ID exists before filtering

## Implementation Plan

1. Add --parent flag to task list command in CLI
2. Implement parent task filtering logic in the action handler
3. Add validation to ensure parent task exists
4. Support --plain flag for unformatted output
5. Show appropriate message when no child tasks found
6. Add unit tests for parent filtering functionality
7. Test with both plain and interactive UI modes

## Implementation Notes

Successfully implemented parent task filtering for the task list command.

Updated README.md documentation to include parent filtering examples and syntax
## Approach taken
- Added `-p, --parent <taskId>` option to the task list command
- Implemented filtering logic after existing status and assignee filters
- Added parent task ID normalization (supports both "100" and "task-100" formats)
- Added validation to ensure parent task exists before filtering
- Enhanced UI filter descriptions to include parent information

## Features implemented
- Parent task filtering with both full (`task-100`) and short (`100`) ID formats
- Proper error handling for non-existent parent tasks
- Contextual messages when no child tasks are found
- Integration with existing status and assignee filters
- Updated interactive UI titles and descriptions to show all active filters

## Technical decisions
- Reused existing task ID normalization pattern from other commands
- Parent validation occurs before filtering to provide early feedback
- Filter description logic refactored to handle multiple filter combinations cleanly
- Maintained backward compatibility with existing filtering behavior

## Modified files
- src/cli.ts - Added --parent option and filtering logic to task list command
- src/test/cli-parent-filter.test.ts - Comprehensive test suite for parent filtering
