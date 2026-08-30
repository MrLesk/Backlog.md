---
id: BACK-666
title: Compact colored acceptance-criteria bar in the TUI
status: To Do
assignee: []
created_date: '2026-08-30 21:48'
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
- [ ] #1 The bar occupies about half its former width; task id and title regain the space
- [ ] #2 The filled portion is colored by completion ratio using the TUI'\''s existing color conventions; renders correctly on terminals without Block Element fonts
- [ ] #3 Board and task list both use the one implementation; tests pin cells and color tags
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
