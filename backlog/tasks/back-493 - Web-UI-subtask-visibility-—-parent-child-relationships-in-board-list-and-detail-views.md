---
id: BACK-493
title: >-
  Web UI: subtask visibility — parent/child relationships in board, list, and
  detail views
status: To Do
assignee: []
created_date: '2026-05-13 10:49'
labels:
  - web-ui
  - subtasks
  - frontend
dependencies: []
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web UI currently has no awareness of parent/child task relationships. Tasks with `parentTaskId` and tasks that have subtasks are shown as flat, unrelated entries. The data model already supports subtasks (`parentTaskId`, `subtaskSummaries` in `src/types/index.ts`) and the core utility `attachSubtaskSummaries` computes them — but neither the web server API nor any frontend component uses this.

This parent task tracks the full delivery of subtask visibility across all web UI surfaces: API enrichment, task detail modal, kanban board cards, kanban board grouping, and the overview list.

The feature was designed to mirror what the TUI already does (`src/ui/task-viewer-with-search.ts:268` calls `attachSubtaskSummaries`). The web UI should reach parity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Parent tasks show their subtasks listed in the detail view
- [ ] #2 Subtasks show a link/reference to their parent task in the detail view
- [ ] #3 Kanban cards for subtasks carry a visual 'Subtask' marker
- [ ] #4 Kanban board groups subtasks immediately below their parent with visible indentation
- [ ] #5 Parent cards on the kanban board show a subtask count and can be collapsed
- [ ] #6 The overview (All Tasks) list indents subtask rows under their parent
- [ ] #7 All subtask-related data is served correctly by the API (subtaskSummaries, parentTaskId, parentTaskTitle)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
