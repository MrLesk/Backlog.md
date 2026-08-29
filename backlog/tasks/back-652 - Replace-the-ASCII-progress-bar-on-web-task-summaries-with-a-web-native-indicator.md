---
id: BACK-652
title: >-
  Replace the ASCII progress bar on web task summaries with a web-native
  indicator
status: To Do
assignee: []
created_date: '2026-08-29 22:03'
labels:
  - web
dependencies: []
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web task cards and summaries render acceptance-criteria progress as a text bar built from block glyphs (`[████░] 3/5` via `"█".repeat()` in src/web/components/AcceptanceCriteriaProgress.tsx, shipped by BACK-552 / PR #906). Maintainer rule: no ASCII/TUI-style indicators in the web UI; each surface uses its native visual language. Replace the glyph bar with a web-native progress rendering (e.g. the circular indicator used elsewhere, or a styled bar element) at both densities where the component is used (TaskCard and TaskList). The TUI keeps its ASCII rendering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Web task summaries show acceptance-criteria progress without ASCII/glyph bars, in both card and list densities, in light and dark themes
- [ ] #2 The TUI acceptance-criteria progress rendering is unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
