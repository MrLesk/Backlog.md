---
id: BACK-590
title: Support mouse clicks in the TUI task composer
status: Done
assignee:
  - '@codex'
created_date: '2026-08-07 20:45'
updated_date: '2026-08-10 05:55'
labels:
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
modified_files:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer.test.ts
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
- [x] #1 Clicking any composer text field focuses it and immediately accepts typed characters, with the caret visible in the clicked field
- [x] #2 Only the clicked field shows the focused highlight; the previously focused control is visibly deselected
- [x] #3 Clicking a selector (Status, Type, Priority) opens its picker
- [x] #4 Clicking back into Title after keyboard navigation away behaves identically to clicking it the first time
- [x] #5 Evidence from a PTY session or widget harness is recorded on the task
- [x] #6 Regression tests cover click-to-edit on a text field and click-to-open on a selector
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Route pointer activation for Title, Description, Status, Type, and Priority through one composer field-click handler that always calls the existing focusField transition first; text fields then inherit its readInput/caret behavior, while selectors open their existing picker.
2. Keep keyboard navigation, selector choice logic, action clicks, persistence, and layout unchanged; ensure repeated clicks cancel and restart the same text reader through focusField rather than creating a parallel mouse-input lifecycle.
3. Add rendered-widget regressions that click Description, navigate away and click Title repeatedly, verify exclusive focus/read mode/caret/text entry, and click each selector to verify its picker and focus restoration.
4. Run the focused composer interaction/model suite, TypeScript, Biome, and build; record deterministic widget evidence on the task and finalize the acceptance criteria.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a single pointer-activation path for Title, Description, Status, Type, and Priority. Every field click enters the existing focusField transition; text fields therefore reuse readInput/caret handling and selectors invoke the existing picker. The handler stops event bubbling so Blessed cannot auto-focus the widget a second time and immediately blur/cancel a freshly started text reader. Keyboard navigation, action clicks, persistence, and layout are unchanged.

Deterministic widget evidence (neo-neo-bblessed createScreen at 100x30): clicking Description made it screen.focused with _reading=true, getCursor defined, cursorHidden=false, a yellow border, the prior Title border gray, and accepted Clicked description. After Tab focused Status, clicking Title made Title exclusively active and accepted First; clicking the already-active Title restarted the same reader and accepted again, producing First again. Clicking Status, Type, and Priority opened their exact configured choice lists; Enter restored focus to the clicked selector with inverse/bold focus styling.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Composer mouse activation now shares the existing focusField/readInput transition with keyboard navigation. Text fields retain a visible caret, editable reader, and exclusive highlight even on repeated Title clicks; selector clicks open their existing pickers and restore selector focus. Added deterministic rendered-widget coverage for text entry, repeated activation, focus styling, cursor visibility, and all three selector pickers. Validation passed: 31 focused composer/model/board-outcome tests (239 assertions), bunx tsc --noEmit, bun run check ., bun run build, and git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
