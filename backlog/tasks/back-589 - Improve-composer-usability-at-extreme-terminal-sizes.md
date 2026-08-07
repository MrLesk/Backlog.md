---
id: BACK-589
title: Improve composer usability at extreme terminal sizes
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
- [ ] #1 At terminal heights of 8 to 10 rows, the focused composer field always shows at least one editable row with a visible cursor
- [ ] #2 Selector values render without clipping at 80 and 100 columns for the longest shipped status value, including the trailing selector cue
- [ ] #3 Compact layout engages whenever the longest label and value would not fit the available field width, not only below a fixed 64-column threshold
- [ ] #4 PTY-rendered evidence at 8 and 10 rows and at 80 and 100 columns is recorded on the task
- [ ] #5 Regression tests cover the short-height layout and the narrow-width selector layout
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
