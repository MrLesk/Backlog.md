---
id: BACK-464
title: Use shared multi-label filter dropdown on board
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-03 19:30'
updated_date: '2026-05-03 19:30'
labels:
  - web
  - filters
  - bug
dependencies: []
modified_files:
  - src/web/components/LabelFilterDropdown.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/test/web-task-list-labels-menu.test.tsx
  - src/test/web-board-filters.test.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to BACK-463. The Kanban board label filter should not be a weaker single-select control while the All Tasks page has a richer multi-select labels dropdown. Extract the All Tasks labels dropdown into a shared web component and use it on both All Tasks and the Kanban board so users can filter the board by multiple labels with the same UX and styling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All Tasks continues to render the same multi-select Labels dropdown behavior and visual treatment as before.
- [ ] #2 Kanban board uses the same shared Labels dropdown component instead of a native single-select label filter.
- [ ] #3 Kanban board supports selecting multiple labels and persists them in URL params using repeated `label` params, matching All Tasks filter semantics where possible.
- [ ] #4 Kanban board label filtering shows tasks that include any selected label, preserving existing assignee and priority filter behavior.
- [ ] #5 Clear filters clears all selected board labels along with assignee and priority filters.
- [ ] #6 Focused web tests cover shared All Tasks labels behavior and multi-label Kanban board filtering/URL persistence.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Commit the BACK-464 task file to `main` by itself, then branch for code changes.
2. Extract the All Tasks labels dropdown into a shared `LabelFilterDropdown` component with the current button/menu styling, outside-click handling, selected-count display, empty-state, checkbox selection, and clear action.
3. Replace TaskList's inline labels menu with the shared component without changing All Tasks label filter state or URL behavior.
4. Change Board/BoardPage label filter state from single string to string array, read/write repeated `label` URL params, and filter board cards when any selected label matches.
5. Replace Board's native label select with the shared labels dropdown beside the lane mode switch and keep Clear filters behavior.
6. Update focused tests for All Tasks parity and Kanban multi-label filtering/URL persistence, then run targeted tests, typecheck, and Biome.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
