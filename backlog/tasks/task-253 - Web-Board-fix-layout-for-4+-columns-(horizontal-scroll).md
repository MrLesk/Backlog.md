---
id: task-253
title: 'Web Board: fix layout for 4+ columns (horizontal scroll)'
status: To Do
assignee: []
created_date: '2025-09-04 19:48'
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
- [ ] #1 With 4+ statuses, the board renders without visual breakage in Safari and Chrome on macOS; horizontal scrolling is smooth.
- [ ] #2 Replace min-w-fit approach with a robust grid: use grid-auto-flow: column + grid-auto-columns: minmax(20rem, 1fr), or an equivalent Tailwind configuration; keep overflow-x-auto wrapper.
- [ ] #3 Column headers and cards remain aligned while scrolling; no jitter/overlap at any scroll position.
- [ ] #4 Regression: 1–3 column layouts remain unchanged and responsive.
- [ ] #5 Document the CSS choices in a brief comment near Board.tsx.
<!-- AC:END -->
