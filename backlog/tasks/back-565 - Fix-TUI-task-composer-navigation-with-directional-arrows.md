---
id: BACK-565
title: Repair TUI task composer UX and navigation
status: Done
assignee:
  - '@codex'
  - '@claude'
created_date: '2026-08-02 21:12'
updated_date: '2026-08-07 20:37'
labels:
  - tui
  - bug
  - ux
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/791'
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
modified_files:
  - src/ui/components/task-composer.ts
  - src/ui/board.ts
  - src/ui/components/help-popup.ts
  - src/ui/unified-view.ts
  - src/test/tui-task-composer.test.ts
  - src/test/help-popup.test.ts
  - src/test/tui-task-creation-entrypoint.test.ts
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
- [x] #1 The implementation plan records the closest existing Backlog.md TUI patterns, the observed mismatches, and the chosen navigation and layout model before code changes.
- [x] #2 The composer has a clear, compact, visually coherent hierarchy for Title, Description, Status, Type, Priority, Create, and Cancel, with visible focus and action affordances at normal and narrow terminal sizes.
- [x] #3 Directional arrow keys provide predictable navigation consistent with existing Backlog.md TUI conventions without breaking caret movement or multiline editing.
- [x] #4 Tab no longer advances composer focus or inserts an unexpected tab character into title or description input.
- [x] #5 Status, Type, and Priority controls visibly behave as selectors, remain discoverable, and open with the established picker interaction; default status and Draft semantics remain unchanged.
- [x] #6 Create and Cancel are clearly differentiated, reachable, and explicit; Esc cancels without writing.
- [x] #7 Validation, retry, persistence, task versus draft routing, board refresh, and focus behavior from BACK-430 remain unchanged unless a regression is explicitly repaired and tested.
- [x] #8 Keyboard help reflects the revised interaction model, and rendered PTY QA verifies discovery, text editing, navigation, selection, creation, cancellation, and resizing at 100x30, 80x24, and 50x18.
- [x] #9 Automated regression tests cover layout, focus, arrow navigation, Tab behavior, text editing, selector activation, Create, Cancel, and existing composer persistence paths.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve BACK-430 semantics by leaving TaskComposerController, canonical TaskCreateInput construction, picker choices, persistence callback, retry/error flow, cancellation result, and board integration unchanged.
2. Follow the audited TUI patterns: filter controls use compact labeled values with a visible ▼ selector cue and inverse/bold focus; picker/list surfaces use arrows, Enter/Space, and Esc; board move/list navigation uses spatial arrows and explicit boundary transitions; popup/help surfaces use concise context-specific key hints. Replace the current detached labels, tall stacked selector boxes, 30-row modal, weak actions, and Tab cycle.
3. Recompose the modal as bordered Title and Description inputs plus compact Details and Actions groups. Use a three-column selector row at normal widths and a stacked selector group on narrow terminals; differentiate Create task and Cancel while keeping active focus unmistakable. Reflow this hierarchy at 100x30, 80x24, and 50x18.
4. Implement a directional focus graph: Up/Down move between vertical rows, Left/Right move within selector/action rows, and boundaries do not wrap unexpectedly. Keep Left/Right as caret movement in both text inputs; Title uses Down to advance, while Description keeps Up/Down for multiline caret movement and changes field only when the caret attempts to leave the first or last visual line. Make Tab and Shift+Tab inert before the input widget can insert a literal tab.
5. Keep established selector activation through the shared single-select popup and return focus to the invoking selector. Keep Enter/Space explicit on selectors and actions, Esc cancellation write-free, validation retry focus behavior, resize cleanup, and created-task board refresh/focus unchanged.
6. Add focused model and widget interaction coverage for responsive geometry, visible selector/action affordances, focus graph, caret and multiline editing, inert Tab behavior, picker activation, Create, Cancel/Esc, resize, validation/retry, and existing persistence/board paths.
7. Run focused tests, TypeScript, Biome, and relevant/full tests; then perform fresh rendered PTY QA at 100x30, 80x24, and 50x18 covering discovery, editing, navigation, selection, creation, cancellation, and resize. Review the final diff for simplification, record verification, commit, push, and open a ready PR titled BACK-565 - Repair TUI task composer UX and navigation.

8. Rebase the repair onto the merged BACK-566 mitigation, then reverse only its temporary runtime/help/test hiding changes so the repaired composer is reachable again. Keep the BACK-566 task record as history, verify the final diff contains the restored entrypoint plus BACK-565 UX work only, rerun focused composer/entrypoint/help tests and project checks, and force-push with lease without merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recomposed the modal around bordered Title/Description fields, a compact responsive Details selector group, explicit Create task/Cancel actions, and context-specific arrow-key help. Added a spatial focus graph while preserving caret and multiline behavior; Tab/Shift+Tab are intercepted before text widgets can insert or move focus. Kept controller, canonical persistence, Draft/default status routing, validation/retry, compensation, board refresh, and created-task focus paths intact.

Verification: bun test src/test/tui-task-composer.test.ts (51 pass); full bun test (1884 pass, 5 skipped, 0 fail); bunx tsc --noEmit; bun run check .; bun run build. Rendered PTY QA exercised discovery, title caret editing, multiline description editing, inert Tab, arrow navigation, status/type/priority pickers, task and Draft creation, Esc/Cancel no-write behavior, and live resize at 100x30, 80x24, and 50x18.

PR #833 follow-up: rebased onto origin/main at eed14499 (merged BACK-566), then reversed only the temporary entrypoint-hiding runtime/help/test changes. The restored board, help, unified-view, and help-test files are byte-identical to their pre-mitigation f321ec76 versions; the BACK-566 task record remains unchanged and the disabled-entrypoint test is removed. Rebase verification passed: 20 focused composer model/interaction/board-outcome tests, 8 help/unified-view tests, bunx tsc --noEmit, Biome on all touched source/tests, bun run build, git diff --check, and the explicit mitigation audit. A concurrent machine-wide Git process storm made the unchanged long-running canonical persistence group exceed its timing assumptions during this follow-up; persistence code was not changed, and the prior isolated full run remains recorded above (1884 pass, 5 skipped, 0 fail).

PR #833 review follow-up (two P2 findings, both reproduced first in tmux before fixing).

Finding 1 - composer unusable below ~14 rows. getTaskComposerLayout floored popupHeight at 14, and blessed centers a popup by subtracting half its height, so an 80x10 terminal produced a 14-row popup starting at row -2: the Create/Cancel, error and help rows rendered off-screen and the fields drew over the board. Fixed by flooring on the screen instead (popupHeight = min(20, max(3, screenHeight - 2))) and by capping every popup dimension to the screen inside createPopupChrome, which also covers confirm-popup's fixed height 10.

Two blessed defects surfaced while verifying the small-size layout. (a) box({ scrollable: true }) is a disabled no-op in neo-neo-bblessed, so the composer's form never clipped or scrolled and scrollFieldIntoView's scrollTo?.() call was dead: the viewport now uses a real scrollablebox via a shared createScrollableViewport helper, and the offset is set through childBase. (b) A scrolled viewport does not render its grandchildren, so the selectors and buttons vanished once the form scrolled; the Details frame is now decoration only and the selectors and buttons are direct children of the viewport positioned in viewport coordinates (the actionsGroup wrapper is gone). Screen._focus also auto-scrolls using an offset relative to the widget's immediate parent, so scrollFieldIntoView now runs after focus() rather than before.

Finding 2 - help popup clipped its last row. The fixed 20-row popup gives content 16 rows while BOARD_SHORTCUTS now renders 17 lines, so 'q/Esc - Quit / Close' was cut. The popup is sized to its content within screen bounds (getHelpPopupHeight = clamp(shortcuts + 4, 5, screenHeight - 2)) and the content is scrollable with up/down, with a scroll hint added to the footer only when the list does not fit.

Verification. Real interactive runs in detached tmux sessions at 80x10, 80x24 and 120x30 against a disposable fixture project, capturing tmux capture-pane after every step. At all three sizes: board renders; N opens a fully visible composer (title/description/details/actions plus the error and help rows); arrow keys move spatially between fields; the status/type/priority pickers open, apply and restore focus; a typed title submits once with the 'Created TASK-n.' footer outcome; Esc cancels without writing; and the help popup shows its final q/Esc row (directly at 80x24 and 120x30, by scrolling at 80x10). At 80x10 specifically, submitting an empty title shows 'Title is required.' in the visible error row. Checks: bunx tsc --noEmit; Biome clean on all 341 src files (run with --vcs-enabled=false because this worktree lives under a gitignored .claude path, which makes 'bun run check' match zero files); focused composer/help tests 55 pass; full bun test 1886 pass, 5 skip, 0 fail.

Observed but not fixed (pre-existing, outside these findings): openSingleSelectFilterPopup passes 'selected: selectedIndex' to blessed's list(), which ignores the option, so every single-select picker opens highlighting the first row instead of the current value - visible when opening the composer's Status picker with 'To Do' already selected. Also src/ui/tui.ts, src/ui/overview-tui.ts and src/ui/board.ts still pass scrollable: true to box(), which is the same no-op.

Review advisory follow-up (a664c869, on top of 81f361bb). Added two regression tests and clarified one misleading option; no behaviour change.

Regression coverage for the scrolling path. The earlier tests pinned the layout clamps but never exercised the viewport actually scrolling, because at 100x30 and 50x18 the whole form fits and form.childBase stays 0 - so a regression in scrollFieldIntoView or createScrollableViewport would have passed the suite while leaving Status/Type/Priority and the buttons unreachable at 80x10. src/test/tui-task-composer.test.ts now opens the composer on an 80x10 screen, asserts childBase is 0 at rest, arrows down to Create task and asserts childBase > 0, then submits with an empty title (which routes focus back to Title through the validation path) and asserts childBase returns to 0. New src/test/popup-chrome.test.ts covers the shared createPopupChrome clamp behaviourally through openConfirmPopup, whose fixed 40x10 does not fit the 30x8 screen it is opened on: the resolved popup width and height must stay within the screen and its atop/aleft must be non-negative.

Both tests were checked against deliberately broken builds before being kept: neutering scrollFieldIntoView to childBase = 0 fails the composer test, and removing the fitToScreen calls from createPopupChrome fails the popup-chrome test. Both sources were then restored and confirmed byte-identical to the pushed versions.

ignoreKeys correction. src/ui/components/task-composer.ts passed ignoreKeys: ["tab"] to the title textbox, which reads as if it suppressed Tab. The fork types the option as boolean (element.ts, scrollablebox.ts) and its only consumer is scrollablebox.ts's 'if (options.keys && !options.ignoreKeys)', so the array was merely truthy: it suppressed the inherited scroll key bindings, and Tab inertness has always come from makeTabInert. Changed to true with a comment naming what it does - behaviour-identical. Re-verified interactively at 80x24 because the line touches title-input key handling: typing abc, pressing Tab, then typing def yields 'abcdef' with no tab character and focus unmoved; two Lefts then X yields 'abcdXef' so caret movement is intact; Down still moves focus to Description.

Checks for this delta: bunx tsc --noEmit; Biome clean on 342 src files; composer/help/popup-chrome tests 57 pass; full bun test 1888 pass, 5 skip, 0 fail.

Maintainer hands-on findings: two deletion bugs and Tab navigation (product change).

Reproduced both bugs in tmux at 80x24 before touching code. Title: typing 'abc' then Backspace still displayed 'abc'; typing 'X' then displayed 'abX', proving the character had been removed but never repainted. Description: typing 'hello' then Backspace then 'Z' gave 'helloZ', so nothing was deleted at all.

Root causes, confirmed in the installed neo-neo-bblessed and matching janosmiko's diagnosis in PR #809. (1) textbox.ts's _listener handles Backspace by slicing the value and returning before the trailing screen.render(), so the field only repaints on the next keystroke - and it always slices the END of the value, ignoring the caret. (2) textarea.ts's Backspace branch is 'if (this.screen.fullUnicode) { }' - empty - so Backspace is a complete no-op whenever the terminal reports unicode support. screen.fullUnicode is 'options.fullUnicode && this._unicode', which is why the bug appears in a real terminal but not in the test harness, whose program is built with tput disabled.

Approach adapted from janosmiko's PR #809 (credit to janosmiko for the root-cause diagnosis and the composer-owns-deletion approach). His deleteLastChar/deleteLastWord only operate on the end of the value; this version is caret-aware because the maintainer asked for mid-field deletion. The widgets report the caret as a negative offset from the end of the current wrapped line, so caretIndexFromCursor converts that to an index by counting what follows it (rest of the current line, following wrapped lines, and one character per logical line break), and deletionStart resolves how far back Backspace or Ctrl+W should reach. Deleting only changes text on one side of the caret, so the end-relative offsets survive and are re-applied to make the widget clamp and repaint. stripInjectedTabs is not needed here because the widget never sees Tab.

The single mechanism is ownInputKeys, which replaces makeTabInert: it shadows the widget's _listener so tab, backspace and delete never reach it, leaving the composer as the only implementation. This is why removing makeTabInert for Tab navigation also had to move deletion - the same shim governs both. Delete was also owned and implemented as forward-delete: it shares the textbox's broken end-slicing path, and suppressing it without a replacement would have left the reported bug's sibling silently dead. Ctrl+W fell out of the same helper as requested.

Tab/Shift+Tab now traverse Title, Description, Status, Type, Priority, Create, Cancel and wrap at both ends, bound on every control alongside the existing arrows and Enter. Tab leaves the Description instead of typing a tab. The composer help line gained the Tab hint in three width-aware variants so it still fits at 50 columns.

Verification. tmux at 80x24 and 80x10: Backspace at end and mid-field in Title and Description, including a two-line description where the deletion happened on the second line; caret confirmed to stay put by typing after each deletion; Ctrl+W word delete; Delete forward-delete; Tab forward through all seven controls with wrap to Title, Shift+Tab backward with wrap to Cancel, focus highlight verified from the captured attributes at each step; Tab into and out of the Description leaves the field text untouched; task created from a Tab-reached Create button. Tests: caretIndexFromCursor and deletionStart unit cases (single line, two logical lines, one wrapped logical line), a rendered-harness deletion test that forces screen.fullUnicode true to reproduce the real terminal condition and asserts both a repaint and mid-field/Ctrl+W results in both fields, and the former Tab-inertness test rewritten to pin full Tab and Shift+Tab traversal with wrapping. The deletion test was confirmed to fail with the deletion binding removed. Gate: bunx tsc --noEmit, Biome clean on 342 files, composer/help/popup-chrome suites, full bun test 1891 pass, 5 skip, 0 fail.

Note: the harness only exposes these bugs when screen.fullUnicode is forced on, so any future editing test must set it or it will pass against broken code.

Codex review follow-up: three accepted findings.

P1 crash on joining description lines. Reproduced first in tmux: a two-line description, caret at End of line one, Delete - the whole TUI died and took the tmux server with it, with 'TypeError' in stderr. Root cause is in the widget: setValue immediately calls _updateCursor, which reads _clines[this._clines.length - 1 + this.offsetY]; removing the newline shrinks the wrapped lines while the negative row offset still points a line further down, so currentText is undefined and strWidth(undefined) throws. deleteText now parks the caret on the last line via setCursor(0, 0) before setValue - a position valid for any content - then restores the exact caret with the new cursorFromCaretIndex helper, the inverse of caretIndexFromCursor, and repaints via _updateCursor. moveCursor could not be used for the restore because it recomputes the column whenever the row changes.

P1 wrong status silently confirmed. openSingleSelectFilterPopup passed 'selected: selectedIndex' to the list widget, which always starts on row 0 and ignores the option, so the Status picker opened on Draft and Enter confirmed Draft instead of the current value. Fixed with an explicit picker.select(selectedIndex) after construction. This is janosmiko's fix from PR #809 - credit to janosmiko. His accompanying vi:true change was deliberately not taken here; it stays with the separate salvage task.

P2 surrogate-pair corruption. Backspace or Delete next to an astral character removed one UTF-16 unit and left an unpaired surrogate, which renders as a replacement character and would have been written to the task file. deletionStart and the new deletionEnd now step over a full pair in both directions.

Verification. tmux at 80x24 with stderr captured to a file: Delete at the end of a nonfinal line joins the lines with empty stderr and the caret verified at the join by typing into it; Backspace at the start of the second line does the same from the other side; the Status picker opens with To Do inverted rather than Draft, and Enter without navigating keeps To Do; Backspace beside an emoji removes it whole, and the created task file was inspected programmatically and contains no unpaired surrogate or replacement character. Tests, each confirmed to fail against a deliberately broken build: the line-join test reproduces the exact 'undefined is not an object (evaluating str.length)' crash when the cursor parking is removed; the picker test returns 'Draft' instead of 'In Progress' when picker.select is removed; the emoji assertions produce 'ab�cd' when the surrogate step is removed. Added a caret round-trip property test over single-line, two-logical-line and wrapped-line models. Gate: bunx tsc --noEmit, Biome clean on 342 files, composer/help/popup-chrome 64 pass, full bun test 1895 pass, 5 skip, 0 fail.

Codex's help-popup finding is stale: it describes the fixed 20-row popup that commit 81f361bb already replaced with content-based sizing plus scrolling. The remaining Codex findings were deferred to follow-up tasks by coordinator decision and are untouched here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebased PR #833 onto merged BACK-566 and restored the repaired create-task entrypoint by reversing only the temporary board/help/unified-view/test mitigation while keeping the BACK-565 composer UX intact. Verified with 28 focused entrypoint/UX/help/unified tests, TypeScript, Biome, build, diff checks, and byte-for-byte comparison with the pre-mitigation entrypoint implementation; the earlier isolated full suite remained 1884 pass, 5 skipped, 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
