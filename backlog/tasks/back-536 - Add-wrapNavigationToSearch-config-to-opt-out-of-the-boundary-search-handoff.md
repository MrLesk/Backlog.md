---
id: BACK-536
title: Add wrapNavigationToSearch config to opt out of the boundary search handoff
status: Done
assignee: []
created_date: '2026-07-11 16:30'
updated_date: '2026-07-11 16:30'
labels: []
dependencies: []
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the TUI, pressing j on the last row or k on the first row (or k at the top of the focused detail pane) moves focus into the search input. This wrap was added on purpose (task back-399), but it surprises vim-style navigation users: j/k are expected to stay inside the list, and / and Ctrl+F already focus search directly. Add an opt-out config key, wrapNavigationToSearch (boolean, default true), that keeps the current behavior by default and, when set to false, stops the handoff in the task list, the detail pane, and the kanban board (including empty columns). With the handoff disabled, boundary navigation falls back to the circular wrap that both views used before back-399 (introduced in task-248).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New boolean config key wrapNavigationToSearch (default true) round-trips through config get/set/list and the config file
- [x] #2 When false, boundary navigation in the task list, detail pane, and kanban board (including empty columns) no longer moves focus to search and falls back to circular navigation
- [x] #3 Default behavior is unchanged when the key is unset or set to true
- [x] #4 Helpers and config round-trip are covered by tests; ADVANCED-CONFIG.md documents the key
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add wrapNavigationToSearch to BacklogConfig, the snake_case config parser/serializer (wrap_navigation_to_search), and the config watcher key list. 2. Wire backlog config get/set/list. 3. Extend shouldMoveFromListBoundaryToSearch / shouldMoveFromDetailBoundaryToSearch with a wrapNavigationToSearch parameter (default true) and pass the config value at all call sites. 4. Board: extract a pure resolveBoardBoundaryToSearch helper covering the empty-column jumps, and fall back to circular navigation when the handoff is disabled. 5. Tests for the helpers and the config round-trip; document the key in ADVANCED-CONFIG.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: bunx tsc --noEmit clean, bunx biome check clean, bun test 1671 pass / 2 skip / 0 fail. Default behavior is unchanged when the key is unset or true; the config round-trip test covers the false value specifically so a truthiness regression in the serializer cannot slip through.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
