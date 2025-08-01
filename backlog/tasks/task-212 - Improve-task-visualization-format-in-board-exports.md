---
id: task-212
title: Improve board export UI formatting and readability
status: To Do
assignee: []
created_date: '2025-07-27'
labels:
  - formatting
  - dx
  - cli
dependencies: []
---

## Description

Update the task display format in board exports to use a cleaner, more scannable format with proper handling of assignees and labels

## Acceptance Criteria

- [ ] Task ID displays in bold uppercase format (e.g. **TASK-204**)
- [ ] Assignees shown in brackets at the beginning when present
- [ ] No 'Assignees: none' text when there are no assignees
- [ ] Labels displayed on new line with # prefix and italic formatting
- [ ] Labels line omitted entirely when no labels exist
- [ ] Format applied consistently to both regular export and README export
