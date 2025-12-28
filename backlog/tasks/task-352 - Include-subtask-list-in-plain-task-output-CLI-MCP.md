---
id: task-352
title: Include subtask list in plain task output (CLI + MCP)
status: To Do
assignee: []
created_date: '2025-12-25 21:46'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the actual list of child tasks when viewing a task in plain text so agents can see subtasks without running extra queries. This should work for CLI `task view`/`task <id>` with `--plain` and for the MCP `task_view` tool output; right now plain output only shows a count when subtasks are explicitly present.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Plain task output for a parent task includes a subtask list derived from tasks whose `parent_task_id` matches the viewed task ID, with each entry showing subtask ID and title in a stable order.
- [ ] #2 CLI `backlog task view <id> --plain` and `backlog task <id> --plain` include the subtask list when present.
- [ ] #3 MCP `task_view` tool output includes the same subtask list when present.
- [ ] #4 Automated tests cover a parent task with subtasks and a task with no subtasks for both CLI plain output and MCP `task_view` behavior.
<!-- AC:END -->
