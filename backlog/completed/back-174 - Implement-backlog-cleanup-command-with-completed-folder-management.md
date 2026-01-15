---
id: BACK-174
title: Implement backlog cleanup command with completed folder management
status: Done
assignee: []
created_date: '2025-07-12'
updated_date: '2025-07-12'
labels: []
dependencies: []
---

## Description

The backlog has too many completed tasks (131+ in "Done" status) cluttering the main board view. Users need a way to manage completed tasks without deleting or archiving them permanently. Implement a cleanup command that moves old Done tasks to a separate "completed" folder, reducing board clutter while keeping tasks accessible.

## Acceptance Criteria

- [x] Interactive cleanup command with age-based selection (1 day to 1 year)
- [x] Preview of tasks to be moved before confirmation
- [x] Move old Done tasks to backlog/completed/ folder structure
- [x] Preserve task accessibility through listAllTasks() method
- [x] Git properly recognizes file moves as renames (not delete+create)
- [x] Support both autoCommit enabled and disabled scenarios
- [x] Clear user feedback about operations and staging status
- [x] Maintains all existing functionality and tests

## Implementation Plan

1. Add COMPLETED directory constant to project structure
2. Implement FileSystem operations for completed folder management
3. Add Core methods for task completion and age-based filtering
4. Create interactive CLI cleanup command with prompts
5. Implement proper Git move detection using fs.rename()
6. Add comprehensive test coverage for new functionality
7. Update documentation and help text

## Implementation Notes

Successfully implemented the backlog cleanup command with completed folder management:

**Core Infrastructure:**
- Added COMPLETED constant to DEFAULT_DIRECTORIES in constants/index.ts
- Extended FileSystem with completeTask(), listCompletedTasks(), getCompletedDir() methods
- Added Core methods: completeTask(), getDoneTasksByAge(), listAllTasks()

**CLI Command:**
- Created interactive `backlog cleanup` command with age selection (1 day to 1 year)
- Added task preview and confirmation prompts using prompts library
- Implemented batch processing with progress feedback
- Added proper error handling and user guidance

**Git Integration:**
- Added stageFileMove() method to GitOperations for proper move detection
- Replaced read+write+delete pattern with fs.rename() for file history preservation
- Enhanced cleanup command to stage moves when autoCommit disabled
- Files now show as renames (R) in git status instead of delete+create

**Testing:**
- Created comprehensive test suite in src/test/cleanup.test.ts
- 8 test cases covering directory creation, task moving, age filtering, error handling
- All existing tests maintained and passing

**Files Modified/Added:**
- src/constants/index.ts - Added COMPLETED directory
- src/file-system/operations.ts - Added completed folder operations
- src/core/backlog.ts - Added task completion and filtering methods
- src/git/operations.ts - Added stageFileMove() method
- src/cli.ts - Added cleanup command implementation
- src/test/cleanup.test.ts - Comprehensive test suite
- README.md - Updated with cleanup command documentation

The cleanup feature successfully addresses the board clutter issue while maintaining full functionality and providing excellent user experience with proper Git integration.
