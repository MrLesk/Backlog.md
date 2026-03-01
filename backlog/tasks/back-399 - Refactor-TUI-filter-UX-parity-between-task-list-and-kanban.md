---
id: BACK-399
title: Refactor TUI filter UX parity between task list and kanban
status: To Do
assignee: []
created_date: '2026-03-01 20:09'
labels:
  - cli
  - tui
  - enhancement
dependencies: []
references:
  - /Users/alex/projects/Backlog.md/src/ui/task-viewer-with-search.ts
  - /Users/alex/projects/Backlog.md/src/ui/components/filter-header.ts
  - /Users/alex/projects/Backlog.md/src/ui/unified-view.ts
  - /Users/alex/projects/Backlog.md/src/utils/task-search.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve the interactive TUI filtering experience so users can use a consistent filter workflow in both the task list and kanban views, and navigation between the filter bar and task rows behaves predictably at list boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kanban view exposes the same filter set as task list for search, priority, labels, and milestone (status remains task-list only).
- [ ] #2 In both task list and kanban views, filter controls use the popup interaction pattern used by the labels filter today.
- [ ] #3 In task list view, keyboard navigation treats the filter bar as a virtual row: Up from the first task moves focus to the search filter, and Up again wraps to the last task.
- [ ] #4 In task list view, Down from the last task moves focus to the search filter, and Down again wraps to the first task.
- [ ] #5 Filter results remain consistent between task list and kanban for shared filters (search, priority, labels, milestone).
- [ ] #6 Automated tests cover the new filter behavior in kanban and the boundary navigation behavior between list rows and filter bar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
