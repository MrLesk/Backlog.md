---
id: BACK-558
title: Prevent browser shortcuts from intercepting inline task fields
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:11'
updated_date: '2026-07-30 19:14'
labels:
  - web-ui
  - keyboard
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/816'
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-task-details-modal-keyboard-shortcuts.test.tsx
  - src/commands/advanced-config-wizard.ts
  - src/commands/configure-advanced-settings.ts
  - src/test/config-commands.test.ts
  - src/test/tui-task-composer.test.ts
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

5. Characterize the Windows config-wizard timeout, replace only the slow test fixture boundary with a deterministic real filesystem fixture, and repeat focused plus full verification before returning a new reviewed head.

6. Characterize the Windows TUI rollback/retry timeout, isolate only non-contract Git/process/filesystem setup through TDD, preserve every rollback, ID-reuse, and unrelated-state assertion, then repeat focused and full verification before review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one ancestor-aware editable-target rule for input, textarea, select, and content-editable elements. Preview e/E and c shortcuts now return before interception when the event originates in an editable target, while edit-mode Escape and Cmd/Ctrl+S remain unchanged.

Test-first proof: the focused suite initially failed because reference e and Done-task c were default-prevented, then passed after the guard. Reviewer follow-up added non-editable c completion coverage and dispatch from a nested content-editable descendant. Mutating closest() to matches() failed the descendant case; removing handleComplete() failed the completion case. Production code was restored after both mutation checks.

Rendered QA: Chrome on the Default profile connected through the enabled extension at http://localhost:6421 on head 0931b6465c257ea0033217cf5a219386a0d77079. Native e/E text was preserved in assignee, labels, references, title, and dependencies while the modal stayed in preview. Non-editable E opened edit mode. Escape returned to preview. Cmd+S entered Saving and resolved without error, and the timestamp-only fixture write was restored. On Done BACK-522, editable c remained literal text; non-editable C opened the native completion confirmation, and completion was not accepted.

Browser-control tooling timed out while dismissing that final native confirmation. Recovery rediscovered the tab, but subsequent dialog inspection, Escape dismissal, and DOM snapshot timed out, so no screenshot or final tab-cleanup verification was captured. The fresh reviewer accepted this as tooling cleanup after the required behavior had already been observed, not an unmet product gate.

Final verification on the unchanged implementation head: bun test passed 1,785 tests with 4 skipped and 0 failures (7,596 assertions); bunx tsc --noEmit passed; bun run check . checked 339 files with no fixes.

Windows CI reliability follow-up: the only slow config-wizard case submitted a non-empty editor, so it spawned the real PATH lookup (where bun on Windows) even though the test contract is applying and persisting wizard selections. The original Windows run timed out at 10,063.60ms and the single rerun at 10,120.40ms; all BACK-558 shortcut tests passed there. TDD RED replaced the host editor with a fixture editor and requested an injected availability checker; before the seam, the test followed the missing-editor branch and failed (expected installClaudeAgent true, received false). The minimal optional seam defaults to the existing production checker and changes no production behavior. GREEN kept the full wizard, real config save/reload, and all 19 assertions. Local characterization before was 20/20 at 30.89-48.18ms (median 33.11ms); after was 30/30 at 30.69-47.74ms (median 32.88ms), now independent of PATH subprocess latency. Adjacent config/editor tests passed 25/25; shortcut tests passed 6/6; TypeScript, Biome (339 files), and diff checks passed; full suite passed 1,785 with 4 skipped, 0 failed, and 7,596 assertions.

Windows TUI reliability follow-up: profiling isolated the rollback/retry timeout to the fixture's real failing Git hook. The failure path invoked three selected-file commit attempts plus 100ms and 200ms backoffs before exercising Core rollback; Windows Git and process startup expanded that non-contract setup to 10,064.28ms. The test now injects one deterministic auto-commit failure after real staging and index capture, then restores the real commit path for retry. Production code is unchanged, and all 8 rollback, clean-state, input-preservation, same-ID, and no-duplicate assertions remain. The 1.2s characterization changed from RED at 1,205.49ms to GREEN at 695.91ms. Thirty repeated runs passed with 627.84ms minimum, 640.31ms median, and 883.84ms maximum, compared with the prior observed local 1,526.70ms minimum, about 1,552ms median, and 1,736.25ms maximum. The full TUI file passed 47 tests and 222 assertions; adjacent shortcut, config, Core, Git, and auto-commit tests passed 86 tests and 264 assertions; TypeScript and Biome passed; the full suite passed 1,785 tests with 4 skipped, 0 failed, and 7,596 assertions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented task-detail preview shortcuts from intercepting editable fields, made the config wizard test independent of Windows PATH subprocess latency, and made the TUI rollback/retry test deterministic at the auto-commit boundary while preserving real staging, rollback, and retry behavior. Verified focused repetition, adjacent suites, TypeScript, Biome, and the full 1,785-test suite with 0 failures.
<!-- SECTION:FINAL_SUMMARY:END -->
