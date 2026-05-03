---
id: BACK-465
title: 'Detect and warn about duplicate task IDs in web, TUI, and MCP interfaces'
status: In Progress
assignee:
  - claude
created_date: '2026-05-03 20:54'
labels:
  - enhancement
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a git merge between two branches that independently created tasks with the same numeric ID, Backlog.md silently drops one of the duplicates. Users have no visibility into this data loss.

## Problem

Two task files can share the same numeric ID prefix (e.g., `task-123 - Foo.md` and `task-123 - Bar.md`) after a git merge. `Core.loadTasks()` deduplicates them silently via a Map.

## Solution

Add duplicate task ID detection across all three UI surfaces:

1. **Web browser**: Yellow dismissible warning banner listing duplicate groups + copyable AI cleanup prompt
2. **TUI board**: Startup warning in the footer when duplicates are detected  
3. **MCP `task_list`**: Prepend a warning block to the output when duplicates exist

## Implementation

- `src/utils/duplicate-detection.ts` — pure `detectDuplicateTaskIds(tasks)` utility + `buildDuplicateCleanupPrompt(groups)`
- `src/server/index.ts` — `GET /api/tasks/duplicates` endpoint (reads raw filesystem, bypasses Map dedup)
- `src/web/lib/api.ts` — `fetchDuplicateTasks()` client method
- `src/web/App.tsx` — fetch duplicates on load, store in state
- `src/web/components/Layout.tsx` — pass `duplicateGroups` to warning component
- `src/web/components/DuplicateIdWarning.tsx` — amber banner with task list + copy prompt button
- `src/ui/board.ts` — add `startupWarning?` option to `renderBoardTui`
- `src/ui/unified-view.ts` — detect duplicates after loading tasks, pass warning to board
- `src/mcp/tools/tasks/handlers.ts` — prepend warning text to `listTasks()` output
- `src/test/duplicate-detection.test.ts` — unit tests
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
