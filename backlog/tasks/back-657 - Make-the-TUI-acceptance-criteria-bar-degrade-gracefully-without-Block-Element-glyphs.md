---
id: BACK-657
title: >-
  Make the TUI acceptance-criteria bar degrade gracefully without Block Element
  glyphs
status: To Do
assignee: []
created_date: '2026-08-30 13:19'
labels:
  - tui
  - bug
dependencies: []
ordinal: 289000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/ui/acceptance-criteria-progress.ts:22 builds the list/board progress bar from raw U+2588 FULL BLOCK and U+2591 LIGHT SHADE. blessed routes box-drawing characters through the DEC Special Graphics charset so trees and borders render on any terminal, but Block Elements go out as plain Unicode: a terminal font lacking those glyphs draws the bar as blank cells (maintainer-observed: a 9/10 bar rendered empty), and without a UTF-8 locale every glyph becomes a question mark. Make the bar degrade the way box drawing does: ASCII fill, or glyphs blessed routes through ACS.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The progress bar renders a visibly filled bar on terminals whose font lacks Block Element glyphs
- [ ] #2 Rendering in a UTF-8-capable terminal with full fonts is unchanged or better
- [ ] #3 A test pins the emitted characters
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
