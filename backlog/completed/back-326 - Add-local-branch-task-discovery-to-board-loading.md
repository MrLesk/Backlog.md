---
id: BACK-326
title: Add local branch task discovery to board loading
status: Done
assignee: []
created_date: '2025-11-30 19:20'
updated_date: '2025-11-30 19:20'
labels:
  - bug
  - task-loading
  - cross-branch
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tasks created in other local branches (not pushed to remote) were not visible when viewing the board from a different branch.

## Problem

The task loading architecture only checked:
1. Filesystem (current branch)
2. Remote branches (`origin/*`)

Tasks in unpushed local branches were invisible.

## Solution

Added local branch task discovery using the same optimized index-first pattern as remote loading:

**Core changes (`src/core/`):**
- `task-loader.ts`: Added `buildLocalBranchTaskIndex()` to index tasks from local branches
- `remote-tasks.ts`: Added `loadLocalBranchTasks()` to discover and hydrate local branch tasks
- `backlog.ts`: Updated `loadBoardTasks()` and `loadAllTasksForStatistics()` to include local branch discovery

**Web UI changes:**
- `server/index.ts`: Inject local branch tasks into ContentStore on startup; added `crossBranch` query param to `/api/tasks`
- `web/lib/api.ts`: Default to `crossBranch=true` for task fetching

**Tests:**
- `src/test/local-branch-tasks.test.ts`: Coverage for index building, branch filtering, task discovery

## Performance

Uses optimized pattern:
1. Build cheap index without fetching content
2. Only hydrate tasks that don't exist locally
3. Respects `activeBranchDays` config for filtering
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tasks created in local branches are visible from other branches
- [x] #2 Performance remains acceptable (use recent branches filtering)
- [x] #3 Conflict resolution works correctly for tasks in multiple local branches
- [x] #4 Existing remote task loading continues to work
- [x] #5 Tests cover local branch task discovery
<!-- AC:END -->
