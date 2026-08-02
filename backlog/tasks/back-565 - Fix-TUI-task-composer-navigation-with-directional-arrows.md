---
id: BACK-565
title: Repair TUI task composer UX and navigation
status: Done
assignee:
  - '@codex'
created_date: '2026-08-02 21:12'
updated_date: '2026-08-02 22:25'
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebased PR #833 onto merged BACK-566 and restored the repaired create-task entrypoint by reversing only the temporary board/help/unified-view/test mitigation while keeping the BACK-565 composer UX intact. Verified with 28 focused entrypoint/UX/help/unified tests, TypeScript, Biome, build, diff checks, and byte-for-byte comparison with the pre-mitigation entrypoint implementation; the earlier isolated full suite remained 1884 pass, 5 skipped, 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
