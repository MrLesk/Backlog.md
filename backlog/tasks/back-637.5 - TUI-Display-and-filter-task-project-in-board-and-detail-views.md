---
id: BACK-637.5
title: 'TUI: Display and filter task project in board and detail views'
status: To Do
assignee: []
created_date: '2026-08-20 16:21'
labels: []
dependencies:
  - BACK-637.1
parent_task_id: BACK-637
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a project display helper (src/ui/project.ts, mirroring src/ui/task-type.ts). Add 'project' to the FilterControlId union and filter-header state/layout/popup wiring in src/ui/components/filter-header.ts. Show project on board cards (src/ui/board.ts) and in the list/detail view (src/ui/task-viewer-with-search.ts), add project to visibleFilters and the filter picker, add a keyboard shortcut and help-popup entry, and add project to src/ui/unified-view.ts/simple-unified-view.ts filter state. Add a project field to the task composer (src/ui/components/task-composer.ts). The project filter control and any project UI must be hidden entirely when no projects are configured, matching the MCP schema's omit-when-empty behavior from BACK-637.3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task board cards and list rows show the project value when set
- [ ] #2 A project filter control exists in the TUI filter header and board, filtering the visible tasks
- [ ] #3 The task composer includes a project field, populated from configured projects
- [ ] #4 The project filter control and badge are completely absent when no projects are configured
- [ ] #5 Existing TUI tests (board-ui, tui task type equivalents) pass; new coverage added for project display/filtering
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
