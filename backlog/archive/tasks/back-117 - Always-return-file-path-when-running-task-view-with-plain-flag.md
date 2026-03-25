---
id: BACK-117
title: Always return file path when running task view with --plain flag
status: To Do
assignee: []
created_date: '2025-07-06'
labels: []
dependencies: []
---

## Description

**ARCHIVED: Duplicate of task-101**

When using 'backlog task <task-id> --plain', always include the file path in the output. This helps AI agents and automation scripts locate the actual task file for further processing or editing.

This task was identified as a duplicate of task-101 which covers the same functionality with more comprehensive requirements. All requirements from this task have been merged into task-101.

## Acceptance Criteria

- [ ] Add file path to output when using `backlog task <task-id> --plain`
- [ ] Ensure path is absolute and correctly formatted
- [ ] Include path as the first line or clearly marked section
- [ ] Maintain backward compatibility with existing plain output format
- [ ] Test with various task IDs and file locations
