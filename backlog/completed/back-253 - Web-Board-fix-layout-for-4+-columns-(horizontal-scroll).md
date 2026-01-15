---
id: BACK-253
title: 'Web Board: fix layout for 4+ columns (horizontal scroll)'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-04 19:48'
updated_date: '2025-09-06 14:24'
labels:
  - web
  - ui
  - board
dependencies: []
priority: medium
---

## Description

Follow-up to GitHub issue #290. When there are 4+ statuses, horizontally scrolling the Kanban board breaks the layout on web (macOS). Current board uses a grid with min-w-fit and repeat(N, minmax(20rem, 1fr)), wrapped in an overflow-x-auto container. Safari/Chrome can mis-compute widths with min-w-fit and dynamic column counts, causing overlap/jitter on horizontal scroll.

Goal: Make the web Kanban board robust for 4+ columns with smooth horizontal scroll and stable column sizing.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With 4+ statuses, the board renders without visual breakage in Safari and Chrome on macOS; horizontal scrolling is smooth.
- [x] #2 Replace min-w-fit approach with a robust grid: use grid-auto-flow: column + grid-auto-columns: minmax(20rem, 1fr), or an equivalent Tailwind configuration; keep overflow-x-auto wrapper.
- [x] #3 Column headers and cards remain aligned while scrolling; no jitter/overlap at any scroll position.
- [x] #4 Regression: 1–3 column layouts remain unchanged and responsive.
- [x] #5 Document the CSS choices in a brief comment near Board.tsx.
<!-- AC:END -->


## Implementation Plan

1. Replace min-w-fit + repeat grid with grid-flow-col + auto-cols for 4+
2. Keep 1–3 columns responsive with grid-cols classes
3. Ensure overflow-x container and smooth scroll
4. Brief comment near Board.tsx about CSS choice


## Implementation Notes

Board layout overhaul for 4+ columns without giant widths.

- 1–4 columns: responsive fixed grids (no horizontal scroll); 4 columns use lg:grid-cols-4 to fit on normal desktop.
- 5+ columns: switched to grid-auto-flow: column with fixed auto column width (16rem) and horizontal scroll. Eliminates Safari/Chrome jitter from min-w-fit + 1fr.
- Removed min-w/max hacks; grid uses w-max inside an overflow-x-auto wrapper only for >4 columns.
- Column size now stable and compact; headers/cards stay aligned while scrolling.
- Added rationale comment in Board.tsx near getGridClasses (AC #5).
- Validation: bun test ok; tsc clean; Biome has only unrelated warnings.
