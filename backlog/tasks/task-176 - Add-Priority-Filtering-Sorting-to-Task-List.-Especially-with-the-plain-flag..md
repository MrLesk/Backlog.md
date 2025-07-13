---
id: task-176
title: Add Priority Filtering/Sorting to Task List. Especially with the --plain flag.
status: Done
assignee: []
created_date: '2025-07-12'
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
