---
id: BACK-343
title: Clarify Done vs Archived in MCP guidance; add task_complete tool
status: Done
assignee:
  - '@codex'
created_date: '2025-12-14 21:23'
updated_date: '2025-12-17 22:17'
labels: []
dependencies: []
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
The MCP workflow docs currently imply that `task_archive` is part of “completion” (and even describe it as archiving completed tasks). This is easy to misinterpret and leads agents/users to archive `Done` tasks, which conflicts with the project’s policy (“Done tasks should never be archived”) and with the intended cleanup flow (`backlog cleanup` moves older `Done` tasks into `backlog/completed/`).

### What
- Update the MCP overview + tools overview to make `Done` vs `completed/` cleanup vs `archive/` semantics unmistakable, and remove any language implying `task_archive` is for completed work.
- Update the Task Completion Guide to explicitly state that `Done` tasks should not be archived and to point to the cleanup/completed-folder approach.
- Add an MCP `task_complete` tool that moves a task file to `backlog/completed/` (and guard `task_archive` from operating on `Done` tasks with a clear error message).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `task_complete` MCP tool (moves Done tasks to `backlog/completed/`) and added a safety guard to prevent `task_archive` on Done tasks.

Updated MCP workflow docs to clarify Done vs completed-folder vs archive semantics and to point completion workflow at `task_complete`/cleanup.

Verification: `bun test`, `bunx tsc --noEmit`, `bun run check .`.

Note: Moving tasks from Done to completed/ folder is a periodic cleanup operation (via `backlog cleanup` or web UI), not something done immediately after finishing a task. Tasks stay in Done status until the next cleanup cycle.
<!-- SECTION:NOTES:END -->
