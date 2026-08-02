---
id: BACK-565
title: Repair TUI task composer UX and navigation
status: To Do
assignee: []
created_date: '2026-08-02 21:12'
updated_date: '2026-08-02 21:13'
labels:
  - tui
  - bug
  - ux
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/791'
priority: high
type: bug
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Emergency production repair for the v1.49 TUI task composer. The current failure is broader than Tab handling: the composer does not match established Backlog.md TUI interaction patterns. The rendered screen shows weak field and control affordances, excessive empty space, unclear focus and action states, disconnected labels and values, and a Tab-based focus model that conflicts with text entry and the rest of the TUI. Before implementation, audit the closest existing filter, search, move, help, and list navigation surfaces, then redesign this first-slice composer to feel native to Backlog.md while preserving canonical task and draft creation semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The implementation plan records the closest existing Backlog.md TUI patterns, the observed mismatches, and the chosen navigation and layout model before code changes.
- [ ] #2 The composer has a clear, compact, visually coherent hierarchy for Title, Description, Status, Type, Priority, Create, and Cancel, with visible focus and action affordances at normal and narrow terminal sizes.
- [ ] #3 Directional arrow keys provide predictable navigation consistent with existing Backlog.md TUI conventions without breaking caret movement or multiline editing.
- [ ] #4 Tab no longer advances composer focus or inserts an unexpected tab character into title or description input.
- [ ] #5 Status, Type, and Priority controls visibly behave as selectors, remain discoverable, and open with the established picker interaction; default status and Draft semantics remain unchanged.
- [ ] #6 Create and Cancel are clearly differentiated, reachable, and explicit; Esc cancels without writing.
- [ ] #7 Validation, retry, persistence, task versus draft routing, board refresh, and focus behavior from BACK-430 remain unchanged unless a regression is explicitly repaired and tested.
- [ ] #8 Keyboard help reflects the revised interaction model, and rendered PTY QA verifies discovery, text editing, navigation, selection, creation, cancellation, and resizing at 100x30, 80x24, and 50x18.
- [ ] #9 Automated regression tests cover layout, focus, arrow navigation, Tab behavior, text editing, selector activation, Create, Cancel, and existing composer persistence paths.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
