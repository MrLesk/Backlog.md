---
id: BACK-185
title: Fix task listing incorrectly including README.md files
status: Done
assignee:
  - '@claude'
created_date: '2025-07-13'
labels: []
dependencies: []
---

## Description

Task listing was incorrectly fetching README.md and showing it as a broken task due to overly broad file patterns in utility functions. The issue was causing non-task markdown files to appear in task lists and fail parsing, creating a confusing user experience.

## Acceptance Criteria

- [x] README.md files are no longer picked up by task listing functions
- [x] Task utility functions use specific 'task-*.md' pattern instead of broad '*.md' pattern
- [x] Existing task functionality remains unaffected
- [x] All task listing operations (active, drafts, archived, completed) use consistent patterns

## Implementation Notes

Fixed by updating task-path.ts utility functions to use specific 'task-*.md' pattern instead of broad '*.md' pattern. This ensures only actual task files are discovered by the task management system while excluding README.md and other documentation files.
