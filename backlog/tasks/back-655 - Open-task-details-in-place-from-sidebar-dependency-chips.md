---
id: BACK-655
title: Open task details in place from sidebar dependency chips
status: To Do
assignee: []
created_date: '2026-08-30 12:21'
labels:
  - web
  - bug
dependencies: []
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task links in the web sidebar dependency chips (DependencyInput.tsx:132) hardcode `/tasks/<id>`, so clicking one while reading the Kanban Board switches to the All Tasks page and then opens the detail. In-app task links must open the task detail without changing the page the reader is on, deriving the href from the current base path the way the board click path and the task-detail dependency-graph links (BACK-548) already do. External deep links to `/tasks/<id>` keep working.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Clicking a dependency chip from the board opens the task detail while staying on the board
- [ ] #2 Clicking one from All Tasks behaves as today
- [ ] #3 External deep links to /tasks/<id> still resolve
- [ ] #4 A test pins the stay-on-page behavior for the board path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
