---
id: task-176
title: Add Priority Filtering/Sorting to Task List. Especially with the --plain flag.
status: Done
assignee: []
created_date: '2025-07-12'
updated_date: '2025-07-13'
labels:
  - enhancement
dependencies: []
---

## Description

The task list command currently supports filtering by status, assignee, and parent, but there's no way to filter or sort tasks by priority. When working with many tasks, it's difficult to quickly identify high-priority items that need immediate attention. Extend the existing backlog task list command with priority options: --priority high, --sort priority, and combine with existing filters. Focus on CLI functionality especially the --plain flag for AI integration.

## Acceptance Criteria

- [x] Add --priority filter option to task list command
- [x] Add --sort priority option to task list command
- [x] Support combining priority filters with existing filters
- [x] Works correctly with --plain flag for AI integration
- [x] Include priority indicators in plain text output

## Implementation Plan

Phase 1 - CLI Options & Filtering: Add --priority and --sort options to task list command.   
Phase 2 - Priority Sorting: Enhanced sorting in task-sorting.ts with sortByPriority function.  
Phase 3 - Plain Text Output: Priority indicators in format [HIGH] task-123 - Title for AI integration.  
Phase 4 - Testing: Comprehensive tests for filtering, sorting, and plain output validation.

## Implementation Notes

Implementation completed successfully with all acceptance criteria met.  
Key deliverables: 
1) Added --priority filter and --sort options to CLI task list command with validation.
2) Created sortByPriority and sortTasks functions in task-sorting.ts with high->medium->low->undefined ordering.
3) Enhanced plain text output with [HIGH]/[MEDIUM]/[LOW] priority indicators for AI integration.
4) Implemented comprehensive filtering that combines with existing status/assignee/parent filters.
5) Added 23 unit tests covering priority sorting logic and CLI integration scenarios.
6) All tests pass, code properly formatted and linted. Feature ready for production use.
