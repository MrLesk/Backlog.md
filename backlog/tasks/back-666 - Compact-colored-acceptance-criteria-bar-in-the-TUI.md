---
id: BACK-666
title: Compact colored acceptance-criteria bar in the TUI
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 21:48'
updated_date: '2026-08-30 22:09'
labels:
  - tui
  - enhancement
dependencies: []
ordinal: 298000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI list/board AC bar is currently a plain uncolored 10-cell ASCII bar (BACK-657 fixed glyph portability but the result reads as plain text and takes horizontal space from task id and title; maintainer verdict). Make it compact and colored: map progress into fewer cells (about 5) so id and title keep their space, and color the filled portion to represent completion (e.g. red low, yellow partial, green complete, consistent with existing TUI status colors), keeping the ASCII glyphs for font portability and the x/y count text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The bar occupies about half its former width; task id and title regain the space
- [x] #2 The filled portion is colored by completion ratio using the TUI'\''s existing color conventions; renders correctly on terminals without Block Element fonts
- [x] #3 Board and task list both use the one implementation; tests pin cells and color tags
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rework src/ui/acceptance-criteria-progress.ts (the one shared implementation used by board.ts and task-viewer-with-search.ts):
   - Halve the cell counts, keeping the existing availableWidth adaptivity: >= 40 cols -> 5 cells (was 10), narrower -> 3 cells (was 5).
   - Clamp rounding so >0% never renders 0 filled cells and <100% never renders all cells filled (e.g. 1/20 -> 1 cell, 19/20 -> 4 of 5).
   - Color the filled run via the existing wrapStatusColor helper from status-icon.ts, using the TUI's established red/yellow/green semantics: green when checked === total, red when ratio <= 1/3, yellow otherwise.
   - Keep ASCII glyphs (# and -) from BACK-657 and the x/y count text.
2. Exact renderings (wide, 5 cells): 3/5 -> "[{yellow-fg}###{/}--] 3/5"; 1/7 -> "[{red-fg}#{/}----] 1/7"; 5/5 -> "[{green-fg}#####{/}] 5/5"; 0/4 -> "[-----] 0/4" (nothing filled, no tag). Narrow (<40 cols, 3 cells): 4/7 -> "[{yellow-fg}##{/}-] 4/7".
3. Tags are deliberate markup: no data-derived text enters the bar, so #960's escapeBlessedTags for labels is untouched; stripBlessedFgTags used by the board's plain search index strips the -fg tags cleanly.
4. Update src/test/tui-acceptance-criteria-progress.test.ts: pin new cell counts, rounding edges (never-0/never-full clamps), the exact color tags per ratio band, and that both consumers render the identical bar.
5. Verify: bunx tsc --noEmit, bun run check ., bun test; pty capture of task list + board for the maintainer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented compact colored bar in src/ui/acceptance-criteria-progress.ts: wide bar 10->5 cells, narrow 5->3 (same availableWidth>=40 breakpoint); rounding clamped so >0% never shows 0 filled and <100% never shows full; filled run wrapped via the existing wrapStatusColor helper (green complete, red for ratio<=1/3, yellow otherwise). ASCII # / - glyphs and x/y count kept. No data-derived text enters the bar so no interaction with the #960 label escaping; stripBlessedFgTags (board plain search index) strips the tags cleanly.
Verification: bunx tsc --noEmit pass; bun run check . pass; scoped tests 8/8 pass pinning cells, rounding clamps, and exact color tags. Full bun test: 2729 pass; the 3 failures in tui-emoji-width.test.ts fail identically on clean origin/main in this environment (pre-existing, unrelated). Pty capture (expect, TERM=xterm-256color, 140x35) of a demo project through both task list and board TUIs shows ESC[31m# (red 1/7), ESC[33m### (yellow 3/5), ESC[32m##### (green 2/2); the selected row renders the fg-stripped variant by existing selection-highlight design.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Halved the TUI acceptance-criteria bar (5 cells wide, 3 narrow, same responsive breakpoint) and colored the filled run red/yellow/green by completion ratio via the existing wrapStatusColor helper, keeping BACK-657's ASCII glyphs and the x/y count. Board and task list still render through the one shared formatter. Verified with tsc, biome, scoped tests pinning cells/rounding-clamps/color-tags, and pty captures of both TUIs showing the ANSI colors live.
<!-- SECTION:FINAL_SUMMARY:END -->
