---
id: task-308.05
title: Add dynamic completions for task IDs and config values
status: Done
assignee: []
created_date: '2025-10-23 10:09'
updated_date: '2025-10-27 21:33'
labels:
  - completion
  - dynamic
dependencies:
  - task-308.02
  - task-308.03
  - task-308.04
parent_task_id: task-308
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement dynamic completion support that queries the backlog system for context-aware suggestions.

Dynamic completions should include:
- Task IDs when relevant (e.g., 'backlog task edit [TAB]' shows actual task IDs)
- Status values from config (e.g., '--status [TAB]' shows configured statuses)
- Priority values (high, medium, low)
- Label values from existing tasks
- Assignee values from existing tasks

This requires the CLI to provide a completion helper command that shells can invoke to get dynamic values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI provides completion helper command (e.g., 'backlog __complete')
- [x] #2 Task IDs complete when editing tasks
- [x] #3 Status values complete from actual config
- [x] #4 Priority values complete correctly
- [x] #5 Labels complete from existing tasks
- [x] #6 Assignees complete from existing tasks
- [x] #7 Dynamic completions work in bash, zsh, and fish
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dynamic completions are already implemented through the completion helper system:

- `getTaskIds()`: Returns actual task IDs from Core API
- `getStatuses()`: Returns configured status values from config
- `getPriorities()`: Returns high/medium/low
- `getLabels()`: Extracts unique labels from all tasks
- `getAssignees()`: Extracts unique assignees from all tasks
- `getDocumentIds()`: Returns actual document IDs from Core API

The completion helper automatically provides these dynamic completions based on context:
- Task IDs when completing commands like `backlog task edit <TAB>`
- Status values when completing `--status <TAB>`
- Priority values when completing `--priority <TAB>`
- Labels when completing `--labels <TAB>`
- Assignees when completing `--assignee <TAB>`

All three shell scripts (bash, zsh, fish) call the `backlog completion __complete` command which uses these data providers to return context-aware, dynamic completions.
<!-- SECTION:NOTES:END -->
