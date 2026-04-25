---
id: BACK-425
title: Add compact TUI task list view
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - tui
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/509'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #509: provide a compact terminal task list that summarizes tasks and opens details on demand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A compact TUI list summarizes tasks without opening the full board layout.
- [ ] #2 Selecting a task opens the existing task detail view or a modal with full details.
- [ ] #3 Core filters and navigation remain usable in the compact view.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
