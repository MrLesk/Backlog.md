---
id: task-262
title: 'TUI: Show all configured status columns in Kanban'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-07 19:58'
updated_date: '2025-09-13 20:20'
labels:
  - tui
  - board
  - kanban
  - config
  - parity
dependencies: []
priority: medium
---

## Description

Web UI shows all statuses from config as columns in Kanban. The TUI board currently hides empty statuses and only renders columns that have tasks. Update the TUI Kanban to always render every status defined in backlog/config.yml, even when a column has zero tasks, preserving configured order. If tasks use unknown statuses (not in config), show those columns after the configured ones.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI Kanban renders all statuses from backlog/config.yml as columns, even when empty
- [ ] #2 Column order matches the order in config.statuses
- [ ] #3 Empty columns display with title and (0) count; no crashes when selecting columns with no tasks
- [ ] #4 Statuses present on tasks but missing from config appear as extra columns after configured ones
- [ ] #5 When there are no tasks at all, the board still renders all configured columns and navigation works
- [ ] #6 Web UI behavior unchanged; change applies only to TUI
- [ ] #7 Type-check and lint pass; tests cover empty-column rendering and navigation
<!-- AC:END -->

## Implementation Notes

TUI Kanban now shows all configured status columns achieving parity with Web UI. Empty columns display properly with (0) counts, maintains configured order, handles unknown statuses, and includes comprehensive test coverage. Navigation works safely in all scenarios.
