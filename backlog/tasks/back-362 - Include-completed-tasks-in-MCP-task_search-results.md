---
id: BACK-362
title: Include completed tasks in MCP task_search results
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 20:22'
updated_date: '2026-01-16 18:25'
labels:
  - mcp
  - enhancement
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow MCP task_search to find completed tasks (from the completed folder) in addition to active tasks. This enables AI agents to discover historical work and context when searching.

Completed tasks should only appear in MCP search results - they should remain filtered out from task_list, TUI views, web UI views, and other interfaces where they would add noise to active task management.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP task_search includes completed tasks in search results
- [x] #2 Completed tasks are clearly marked in search results (e.g., status shows 'Done' or includes completed indicator)
- [x] #3 MCP task_list does NOT include completed tasks (current behavior preserved)
- [x] #4 TUI and web UI task lists do NOT include completed tasks (current behavior preserved)
- [x] #5 Search index includes both active and completed tasks for MCP context

- [x] #6 Cross-branch and remote loading contribute completed tasks for MCP search (archived excluded).
- [x] #7 Tasks completed on other branches appear in MCP task_search and are marked completed.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review MCP task_search flow + search/index utilities to see current task sources and filters.
2. Locate completed task storage/loading and how status is represented; confirm archived tasks are excluded.
3. Extend MCP task_search indexing to include completed tasks (exclude archived) without changing task_list/TUI/web list behavior.
4. Mark completed tasks clearly in MCP search results (status indicator/flag).
5. Update/add MCP search tests to cover completed inclusion + archived exclusion; ensure task_list/TUI/web list remain unchanged.
6. Run targeted tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary:
- MCP task_search now builds a task search index from active + completed tasks (excluding archived), so completed tasks appear in results.
- Completed tasks are shown with status in MCP search output (fallbacks to "Done" for completed sources).
- Task search index now includes acceptance criteria text and dependency IDs for richer matching.

Tests:
- bun test src/test/mcp-tasks.test.ts src/test/mcp-tasks-local-filter.test.ts src/test/task-search-label-filter.test.ts (fails: missing @modelcontextprotocol/sdk and fuse.js packages; dependencies not installed).

Test update:
- bun test src/test/mcp-tasks.test.ts src/test/mcp-tasks-local-filter.test.ts src/test/task-search-label-filter.test.ts (pass)

Follow-up:
- Inlined trivial MCP task_search helper per feedback to avoid micro abstractions.

Follow-up update:
- MCP task_search now merges core.loadTasks() with filesystem.listCompletedTasks() (completed overrides) instead of using the statistics loader.

Scope expanded per user to include cross-branch/remote completed-task loading for MCP search.

Scope update implementation:
- Extended core.loadTasks with includeCompleted option and reused existing loadRemoteTasks/loadLocalBranchTasks to hydrate completed tasks from branches/remotes.
- Search path now uses loadTasks(includeCompleted: true) and marks latest completed states across branches.

Tests:
- bun test src/test/mcp-tasks.test.ts src/test/mcp-tasks-local-filter.test.ts src/test/task-search-label-filter.test.ts (pass)
<!-- SECTION:NOTES:END -->
