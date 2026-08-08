---
id: BACK-537
title: Scroll the task detail pane with Shift+J/K without leaving the list
status: Done
assignee: []
created_date: '2026-07-11 16:33'
labels: []
dependencies: []
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the task-list TUI view, the detail pane can only be scrolled after moving focus into it (right/l or Enter). Bind Shift+J / Shift+K as screen-level shortcuts that scroll the detail pane body from either pane, so the list keeps focus while long descriptions are read. The shortcut must stay inert while the filter bar is focused, a popup or modal is open, or there is no detail pane, and it must never trigger the boundary handoff into the search field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shift+J / Shift+K scroll the detail pane from the task list without moving focus
- [ ] #2 The shortcut is inert while filters are focused, a popup or modal is open, or no detail pane exists
- [ ] #3 Plain j/k navigation and the boundary search handoff are unaffected
- [ ] #4 Helper branches are fully covered by unit tests and the help popup documents the shortcut
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Export a pure helper shouldScrollDetailPaneFromShortcut(currentFocus, modalOpen, filterPopupOpen, hasDetailPane) in src/ui/task-viewer-with-search.ts. 2. Add screen-level key bindings ['J','S-j'] / ['K','S-k'] that scroll descriptionBox by +/-1 line through the helper without moving focus. 3. Add the 'J/K - Scroll task details' entry to the task-list help popup. 4. Unit-test every helper branch in src/test/task-viewer-detail-scroll.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: bunx tsc --noEmit clean, bunx biome check clean, bun test 1671 pass / 2 skip / 0 fail including the new test file. Uppercase-only bindings follow the existing ['e','E','S-e'] idiom, so plain j/k list navigation is untouched.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
