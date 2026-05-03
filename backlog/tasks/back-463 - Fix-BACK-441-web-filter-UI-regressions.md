---
id: BACK-463
title: Fix BACK-441 web filter UI regressions
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-03 19:05'
labels:
  - bug
  - web
  - filters
dependencies: []
modified_files:
  - src/web/components/Board.tsx
  - src/web/components/TaskList.tsx
  - src/test/web-board-filters.test.tsx
  - src/test/web-task-list-labels-menu.test.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to BACK-441 after manual release testing. The kanban board filter controls are present in source but not obvious enough in the Web UI, and the All Tasks page now duplicates the global sidebar search with its own local `Search tasks` input. Keep the board-level assignee/label/priority filters and URL persistence, make the board filter affordance visible, and remove the duplicate All Tasks text search while leaving the structured table filters intact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The kanban board clearly exposes board filter controls for assignee, label, and priority.
- [ ] #2 Board filter state still reads/writes `assignee`, `label`, and `priority` URL query parameters and clear filters still removes them.
- [ ] #3 The All Tasks page no longer renders a local `Search tasks` text input because global search already exists in the sidebar.
- [ ] #4 All Tasks structured filters for status, priority, label, milestone, and cleanup behavior keep working.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
