---
id: BACK-590
title: Support mouse clicks in the TUI task composer
status: To Do
assignee: []
created_date: '2026-08-07 20:45'
labels:
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
priority: low
type: enhancement
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from Codex review of PR #833 (BACK-565, TUI task composer and board). Mouse clicks in the composer half-work, which is worse than not supporting them.

Clicking the Description field, or clicking back into Title after navigating away with the keyboard, focuses the widget but never enters input-reading mode: the fields are created with inputOnFocus disabled and no click handler routes into the composer focusField/readInput path. What the user sees is the previously focused control still highlighted while typed characters go nowhere visible, which reads as a frozen composer.

Mouse input is already enabled elsewhere in the TUI, so clicks in the composer should either work end to end or not appear to respond at all.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Clicking any composer text field focuses it and immediately accepts typed characters, with the caret visible in the clicked field
- [ ] #2 Only the clicked field shows the focused highlight; the previously focused control is visibly deselected
- [ ] #3 Clicking a selector (Status, Type, Priority) opens its picker
- [ ] #4 Clicking back into Title after keyboard navigation away behaves identically to clicking it the first time
- [ ] #5 Evidence from a PTY session or widget harness is recorded on the task
- [ ] #6 Regression tests cover click-to-edit on a text field and click-to-open on a selector
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
