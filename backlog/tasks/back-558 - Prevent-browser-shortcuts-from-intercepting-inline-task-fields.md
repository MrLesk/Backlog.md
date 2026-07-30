---
id: BACK-558
title: Prevent browser shortcuts from intercepting inline task fields
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:11'
updated_date: '2026-07-30 18:03'
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
- [x] #1 In task preview, typing e or E in assignee, labels, references, title, or dependencies does not prevent the keystroke or enter full edit mode.
- [x] #2 Preview shortcuts do not intercept keystrokes originating from input, textarea, select, or content-editable targets.
- [x] #3 The c completion shortcut follows the same editable-target rule.
- [x] #4 Plain e or E outside editable controls still opens edit mode.
- [x] #5 Existing edit-mode Escape and Cmd/Ctrl+S behavior remains unchanged.
- [x] #6 Automated tests and rendered browser QA cover inline text entry and preserved shortcut behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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
Implemented one ancestor-aware editable-target rule for input, textarea, select, and content-editable elements. Preview e/E and c shortcuts now return before interception when the event originates in an editable target, while edit-mode Escape and Cmd/Ctrl+S remain unchanged.

Test-first proof: the focused suite initially failed because reference e and Done-task c were default-prevented, then passed after the guard. Reviewer follow-up added non-editable c completion coverage and dispatch from a nested content-editable descendant. Mutating closest() to matches() failed the descendant case; removing handleComplete() failed the completion case. Production code was restored after both mutation checks.

Rendered QA: Chrome on the Default profile connected through the enabled extension at http://localhost:6421 on head 0931b6465c257ea0033217cf5a219386a0d77079. Native e/E text was preserved in assignee, labels, references, title, and dependencies while the modal stayed in preview. Non-editable E opened edit mode. Escape returned to preview. Cmd+S entered Saving and resolved without error, and the timestamp-only fixture write was restored. On Done BACK-522, editable c remained literal text; non-editable C opened the native completion confirmation, and completion was not accepted.

Browser-control tooling timed out while dismissing that final native confirmation. Recovery rediscovered the tab, but subsequent dialog inspection, Escape dismissal, and DOM snapshot timed out, so no screenshot or final tab-cleanup verification was captured. The fresh reviewer accepted this as tooling cleanup after the required behavior had already been observed, not an unmet product gate.

Final verification on the unchanged implementation head: bun test passed 1,785 tests with 4 skipped and 0 failures (7,596 assertions); bunx tsc --noEmit passed; bun run check . checked 339 files with no fixes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented task-detail preview shortcuts from intercepting editable fields with one shared ancestor-aware target guard, while preserving e/E and c outside editors plus edit-mode Escape and Cmd/Ctrl+S. Added focused regression and mutation coverage. Verified with 1,785 passing tests, TypeScript, Biome, and accepted real Chrome interaction QA.
<!-- SECTION:FINAL_SUMMARY:END -->
