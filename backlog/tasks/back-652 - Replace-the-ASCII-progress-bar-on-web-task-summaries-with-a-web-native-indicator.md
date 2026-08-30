---
id: BACK-652
title: >-
  Replace the ASCII progress bar on web task summaries with a web-native
  indicator
status: Done
assignee:
  - '@claude'
created_date: '2026-08-29 22:03'
updated_date: '2026-08-30 22:07'
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
- [x] #1 Web task summaries show acceptance-criteria progress without ASCII/glyph bars, in both card and list densities, in light and dark themes
- [x] #2 The TUI acceptance-criteria progress rendering is unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the indexing chip spinner-ring design (BranchIndexingIndicator, BACK-654) as the geometry/palette reference: small circle, 2px stroke, blue track (blue-200 / dark blue-400/30) with the component's existing blue-600 / dark blue-300 progress color.
2. Rewrite src/web/components/AcceptanceCriteriaProgress.tsx: replace the glyph bar with a static SVG ring (track circle + strokeDasharray progress arc, rotated to start at 12 o'clock) plus the existing x/y fraction text; keep role=progressbar, aria attrs, title, and the data-acceptance-criteria-progress hook.
3. Replace the glyph-specific cells prop with density: card | list (12px ring on board cards, 14px in the list); update TaskCard and TaskList prop wiring only.
4. Update src/test/web-task-acceptance-progress.test.tsx: pin ring rendering (svg, arc dasharray from checked/total) at both densities, assert no block glyphs remain, keep aria and re-derive coverage.
5. Verify: bunx tsc --noEmit, bun run check ., bun test; TUI renderer untouched (BACK-666).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the glyph bar in AcceptanceCriteriaProgress with a static SVG progress ring reusing the indexing chip spinner's geometry and palette (2px stroke, blue-200 track / dark blue-400-30, arc in the component's existing blue-600 / dark blue-300 via currentColor), with the x/y fraction beside it. Prop cells: 5|10 became density: card|list (12px ring on board cards, 14px in the list); TaskCard and TaskList wiring updated. Tests pin ring rendering (arc dasharray from checked/total, track-only at 0 checked, no block glyphs) at both densities. Verified in the running web UI: dark board at partial/zero fill, light All Tasks list at full fill. tsc, biome, scoped tests green; full suite running.

Full-suite verification: 3 local failures are environmental, not from this change — 3x tui-emoji-width fixed by refreshing the worktree's stale node_modules (bun i, bun.lock unchanged), and 1 config-commands tab-indentation case is a Bun 1.4.0 Bun.YAML strictness change vs CI's pinned 1.3.14 (reproduces with this diff absent; flagged separately). Scoped web/TUI progress tests, tsc, and biome are green post-refresh.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the web glyph progress bar in src/web/components/AcceptanceCriteriaProgress.tsx with a static SVG progress ring plus the x/y fraction, reusing the indexing chip spinner ring's geometry and palette (2px stroke, blue track, currentColor arc); prop cells:5|10 became density:card|list with matching one-line wiring updates in TaskCard and TaskList. Verified with updated jsdom tests pinning ring rendering (arc dasharray from checked/total, track-only at zero, no block glyphs) at both densities, tui-acceptance-criteria-progress tests proving the TUI renderer unchanged, live browser QA in dark board and light list views, and tsc/biome green.
<!-- SECTION:FINAL_SUMMARY:END -->
