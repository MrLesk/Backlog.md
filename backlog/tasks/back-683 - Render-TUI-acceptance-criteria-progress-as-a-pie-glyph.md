---
id: BACK-683
title: Render TUI acceptance-criteria progress as a pie glyph
status: To Do
assignee: []
created_date: '2026-09-02 21:40'
labels: []
dependencies: []
ordinal: 315000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI shows acceptance-criteria progress on In Progress rows as an ASCII bar, [###--] 3/5. ASCII was chosen because blessed only guarantees glyph fallback for box-drawing, and Block Elements can render blank or as ? on some fonts. That caution was applied too broadly: the TUI already renders geometric shapes such as ● ○ ◒ ✓ on every supported terminal, and the maintainer had asked for Unicode, not ASCII. The bar also sits before the task ID on In Progress rows only, so IDs do not line up across rows.

Replace the bar with a single pie glyph from the same Unicode block as the shapes already in use, so it mirrors the radial ring the web shows and costs one cell: ○ for nothing checked, ◔ up to a third, ◑ up to two thirds, ◕ above that, ● when every criterion is checked, followed by the checked/total count. Keep the existing color semantics on the glyph (green when complete, yellow underway, red when a third or less). The wide and compact variants collapse into one form. Reserve the indicator column on every row so task IDs align whether or not a row shows progress. Which rows show progress is unchanged: In Progress tasks with criteria.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In Progress rows with criteria show a pie glyph (○ ◔ ◑ ◕ ●) and the checked/total count instead of the ASCII bar, on the board and in the task list
- [ ] #2 The glyph keeps the existing color semantics: green when all criteria are checked, yellow when underway, red when a third or fewer are checked
- [ ] #3 Task IDs align across rows because the indicator column is reserved on rows without progress
- [ ] #4 The glyphs render at the correct width in the TUI, verified with the existing width test infrastructure, and no Block Elements are introduced
- [ ] #5 Plain and MCP list output are unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
