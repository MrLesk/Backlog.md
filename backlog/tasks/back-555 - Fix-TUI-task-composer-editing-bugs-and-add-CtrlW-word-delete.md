---
id: BACK-555
title: Fix TUI task composer editing bugs and add Ctrl+W word delete
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-23 05:08'
updated_date: '2026-07-23 05:20'
labels:
  - tui
  - bug
dependencies: []
priority: medium
type: bug
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The shipped TUI task composer (PR #791) has editing bugs from unhandled neo-neo-bblessed defects and diverges from the BACK-430 first-slice spec. Fix backspace in Title and Description, stop the Status picker preselecting Draft, enable j/k in pickers, align resting status with the CLI wizard, and add Ctrl+W word deletion in text inputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backspace and Delete edit the Title field and repaint immediately
- [ ] #2 Backspace edits the Description textarea under fullUnicode screens
- [ ] #3 Ctrl+W deletes the previous word in Title and Description
- [ ] #4 Opening the Status picker preselects the current value, never Draft; every picker preselects its current value
- [ ] #5 j/k navigate the composer and board single-select pickers
- [ ] #6 Resting Status resolves via getDefaultCreateStatus, matching the CLI wizard
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root-caused four bugs to neo-neo-bblessed defects verified against the installed library, all unhandled by the shipped composer (PR #791): (1) textbox backspace deletes then returns before the trailing render (textbox.ts:117-122); (2) textarea backspace branch is empty under fullUnicode which createScreen always sets (textarea.ts:449); (3) list hardcodes selected=0 and ignores the selected option (list.ts:47) so the Status picker opened on Draft; (4) list binds j/k only under vi (list.ts:119/124) which filter-popup never set.

Fixes: shared filter-popup.ts adds picker.select(selectedIndex) + vi:true (also fixes the board's own filter popups' preselection and j/k). task-composer.ts sets ignoreKeys backspace/delete on the Title textbox and owns deletion via a shared applyDeletion handler using pure deleteLastChar/deleteLastWord helpers; Ctrl+W bound to deleteLastWord on both inputs. Resting status now resolves via getDefaultCreateStatus (exported from task-wizard.ts) to match the CLI wizard.

Skipped the 430 branch's buildComposerStatusOptions(statusWasOpened) machinery: it sets the flag before building choices on open, so Draft always shows in the live picker anyway - behaviorally identical to upstream's always-prepend once bug #3 is fixed. AC #4's binding invariant (opening does not select Draft) is satisfied by the preselection fix.

Tests: pure helper tests (deleteLastChar/deleteLastWord), canonical-To-Do resting-status test, and rendered-harness behavioral tests for backspace+Ctrl+W on both inputs and picker preselection (Enter without navigation returns To Do, not Draft). Gate: tsc clean, Biome clean (339 files), full suite 1781 pass / 4 skip / 2 fail - the 2 failures are pre-existing git-hook composer tests that also fail on clean main. TUI-only j/k navigation left to manual QA as the harness cannot drive list keypress nav.
<!-- SECTION:NOTES:END -->
