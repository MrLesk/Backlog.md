---
id: BACK-558
title: Prevent browser shortcuts from intercepting inline task fields
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 17:11'
updated_date: '2026-07-30 17:42'
labels:
  - web-ui
  - keyboard
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/816'
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-task-details-modal-keyboard-shortcuts.test.tsx
type: bug
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Global task-detail shortcuts currently intercept ordinary text entry in inline-editable controls because the capture-phase key handler does not distinguish editable event targets. User-entered text must remain intact while the existing preview shortcuts continue to work outside editable controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In task preview, typing e or E in assignee, labels, references, title, or dependencies does not prevent the keystroke or enter full edit mode.
- [ ] #2 Preview shortcuts do not intercept keystrokes originating from input, textarea, select, or content-editable targets.
- [ ] #3 The c completion shortcut follows the same editable-target rule.
- [ ] #4 Plain e or E outside editable controls still opens edit mode.
- [ ] #5 Existing edit-mode Escape and Cmd/Ctrl+S behavior remains unchanged.
- [ ] #6 Automated tests and rendered browser QA cover inline text entry and preserved shortcut behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a focused TaskDetailsModal keyboard interaction test that mounts the real component, reproduces e/E interception across representative input, textarea, select, and content-editable targets, and proves c is protected while non-editable e/E, edit-mode Escape, and Cmd/Ctrl+S remain active.
2. Run the focused test before production changes and confirm it fails specifically because the capture-phase preview shortcuts prevent editable-target key events.
3. Add one local editable-target predicate in TaskDetailsModal and use it only to gate the preview e/E and c shortcut branches, leaving edit-mode Escape and Cmd/Ctrl+S unchanged.
4. Run the focused and related Web task-detail tests, typecheck, Biome, broader tests, git diff checks, and interactive desktop-browser QA; simplify if the implementation can be reduced without weakening coverage.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the preview shortcut guard with one local editable-target rule covering input, textarea, select, and content-editable elements. Added focused mounted-component coverage for all named inline fields, c protection, non-editable e/E, edit-mode Escape, and Cmd/Ctrl+S. RED proof: the new test initially failed because reference e and Done-task c were default-prevented. GREEN proof: all five focused cases pass after the guard. Rendered QA remains pending because the browser-control runtime exposed no available desktop browser in this session.

Fresh reviewer proof gaps addressed without changing production code. The content-editable case now dispatches e from a nested span inside the editable ancestor; mutating the guard from closest() to matches() made that test fail with defaultPrevented=true. A new non-editable Done-task c test verifies apiClient.completeTask receives BACK-558; temporarily removing handleComplete() made it fail with a null completed task ID. Restored the original production implementation after both mutation checks. Rendered browser QA remains pending.
<!-- SECTION:NOTES:END -->
