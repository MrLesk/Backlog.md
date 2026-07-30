---
id: BACK-558
title: Prevent browser shortcuts from intercepting inline task fields
status: To Do
assignee: []
created_date: '2026-07-30 17:11'
labels:
  - web-ui
  - keyboard
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/816'
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
