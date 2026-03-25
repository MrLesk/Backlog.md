---
id: BACK-344
title: 'MCP: Manage milestones (list/add/rename/remove + task milestone support)'
status: Done
assignee:
  - '@codex'
created_date: '2025-12-14 22:53'
updated_date: '2025-12-17 22:16'
labels: []
dependencies: []
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
Agents using the Backlog.md MCP server can’t currently manage milestones (config) or set a task’s `milestone` when creating/editing tasks, which forces people back to the web UI or manual config/task editing.

### What
- Add MCP tools to manage milestones in `backlog/config.json`: `milestone_list`, `milestone_add`, `milestone_rename`, `milestone_remove`.
- Extend `task_create` + `task_edit` to accept a `milestone` field so agents can assign/clear milestones on tasks.
- For rename/remove, update local tasks that reference the milestone (skip cross-branch tasks) and return a clear summary of what changed.
- Add tests covering the new tools and milestone edits via MCP.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `milestone_list` outputs configured milestones and flags any task-only milestones found on local tasks.
- [x] #2 `milestone_add` validates name (trimmed, case-insensitive uniqueness), updates config, and returns updated milestone list.
- [x] #3 `milestone_rename` updates config and updates local tasks referencing the old milestone; returns counts and errors clearly.
- [x] #4 `milestone_remove` removes from config and clears (default) or reassigns local tasks’ milestones; returns counts and errors clearly.
- [x] #5 `task_create` and `task_edit` accept `milestone` and persist it on disk; `milestone: null` clears it.
- [x] #6 Automated tests cover milestone tools + task milestone create/edit paths.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed: MCP milestone management tools implemented and tested.
<!-- SECTION:NOTES:END -->
