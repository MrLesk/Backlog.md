---
id: BACK-589
title: Improve composer usability at extreme terminal sizes
status: Done
assignee:
  - '@codex'
created_date: '2026-08-07 20:45'
updated_date: '2026-08-10 05:47'
labels:
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
priority: low
type: enhancement
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from Codex review of PR #833 (BACK-565, TUI task composer and board). Two composer layout findings were accepted as real but deferred to a follow-up.

At very short terminals the composer stops being editable. At 8 rows the 6-row popup leaves the scrollable form a single visible row, so the 3-row bordered Title and Description fields render as a border with no editable row and no visible cursor (src/ui/components/task-composer.ts, popup height computation). A user in a small pane cannot tell the composer is accepting input at all.

At common widths the selector labels clip. With Status sized at 30% of the width, an 80- or 100-column terminal gives that field 20 columns while "Status: In Progress" plus the down-arrow cue needs 21, so the cue that marks it as a selector is cut off. Compact mode only activates below 64 columns, so the breakpoint does not track the label widths that actually need to fit.

The goal is a composer that stays legible and obviously editable across the terminal sizes people really use, without waiting for a full responsive redesign.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At terminal heights of 8 to 10 rows, the focused composer field always shows at least one editable row with a visible cursor
- [x] #2 Selector values render without clipping at 80 and 100 columns for the longest shipped status value, including the trailing selector cue
- [x] #3 Compact layout engages whenever the longest label and value would not fit the available field width, not only below a fixed 64-column threshold
- [x] #4 PTY-rendered evidence at 8 and 10 rows and at 80 and 100 columns is recorded on the task
- [x] #5 Regression tests cover the short-height layout and the narrow-width selector layout
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the fixed width breakpoint with selector-content constraints: size the popup up to the available terminal width, and use the compact selector layout only when the longest configured label/value plus the selector cue cannot fit a normal selector column.
2. Derive the short-popup minimum from the popup chrome and the three rows required by a bordered text input so Title and Description each scroll into a viewport with an editable row at 8-10 terminal rows; preserve focus, navigation, picker, and persistence behavior.
3. Add deterministic layout and rendered-widget regression coverage for 8-10 rows, 80/100 columns, the shipped In Progress status, and longer configured selector values.
4. Run the focused composer suite, TypeScript, Biome, and build; exercise the built TUI in PTYs at 80x8, 100x8, 80x10, and 100x10, then record cursor and selector-cue evidence on the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented constraint-based composer geometry. The popup now grows only enough for the longest configured selector content measured with Bun.stringWidth, stacks selector rows when that content cannot fit a normal column, and reserves popup chrome plus a complete three-row bordered input at extreme heights. Interaction, picker, focus graph, and persistence paths are unchanged.

Deterministic rendered-widget evidence: the focused Title and Description inputs were exercised at 80x8, 80x9, and 80x10. In every case the popup was 8 rows, the scrollable form was 3 rows, the focused widget was actively reading, its first editable row was within the form viewport, getCursor returned a caret, and the terminal cursor was visible. At 80x24 and 100x24, Status: In Progress ▼ measured 21 terminal cells and the rendered selector width was 21 cells, including the trailing cue. A long configured status at 100 columns switched to the stacked selector geometry and rendered without clipping.

PTY evidence from the compiled dist/backlog against a filesystem-only fixture: 80x8 cursor=(7,3), 100x8 cursor=(17,3), 80x10 cursor=(7,4), and 100x10 cursor=(17,4); each coordinate is the visible editable Title row. After selecting In Progress in each PTY, capture-pane showed the complete Status: In Progress cue cell followed by padding, plus complete Type and Priority selectors. This tmux/neo-neo-bblessed capture backend renders the Unicode ▼ fallback glyph as ?, so the deterministic widget assertion separately verifies the literal ▼ code point and its 21/21-cell fit.

Validation: 33 composer model, interaction, and board-outcome tests passed (270 assertions), including all five new layout regressions. bunx tsc --noEmit, bun run check ., bun run build, and git diff --check passed. The complete composer file was also attempted twice: all 63 other tests passed, while the unrelated watchTasks delivery case timed out after its fixed 3-second filesystem-event wait both in-suite and alone; no watcher or persistence code is touched by this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the TUI task composer usable at extreme sizes by deriving popup and compact geometry from actual selector display widths and the minimum visible bordered-input height. Added rendered-widget regressions for both text cursors at 8-10 rows, unclipped In Progress selector cues at 80/100 columns, and content-driven stacking; verified the compiled UI in four tmux PTYs plus 33 focused tests, TypeScript, Biome, and build.
<!-- SECTION:FINAL_SUMMARY:END -->
