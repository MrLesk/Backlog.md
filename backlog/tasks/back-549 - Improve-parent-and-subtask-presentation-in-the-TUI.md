---
id: BACK-549
title: Improve parent and subtask presentation in the TUI
status: To Do
assignee: []
created_date: '2026-07-16 21:50'
labels: []
dependencies: []
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve how the TUI presents existing parent and subtask relationships across list, board, and task detail views. Make hierarchy, status, progress, and keyboard navigation clear in normal and narrow terminals while preserving the current task model and mutation behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 List, board, and task detail views clearly distinguish parent tasks from child tasks and show each related task’s ID, title, and status.
- [ ] #2 Parent progress summarizes completed children using the project’s configured terminal-status semantics, while tasks with no children retain an uncluttered no-child state.
- [ ] #3 Keyboard navigation between parent and child tasks preserves predictable selection, scrolling, focus, and focus return when entering and leaving details.
- [ ] #4 Children in different statuses, tasks with many children, and tasks with nested descendants remain discoverable and readable across list, board, and detail views.
- [ ] #5 The change does not alter task or subtask creation, editing, ordering, movement behavior, or the semantics of parent-child relationships.
- [ ] #6 Normal and narrow terminal layouts avoid clipping hierarchy, identifiers, status, progress, and navigation cues, and their contextual help remains usable.
- [ ] #7 Rendered QA covers list, board, and task detail views in normal and narrow terminals for no-child, cross-status, many-child, and nested-child cases.
- [ ] #8 Automated tests cover hierarchy rendering, terminal-status progress, keyboard navigation, selection and focus return, and no-child, cross-status, many-child, nested, and narrow-layout edge cases.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
