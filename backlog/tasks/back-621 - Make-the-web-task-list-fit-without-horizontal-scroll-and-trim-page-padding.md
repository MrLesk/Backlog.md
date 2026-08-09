---
id: BACK-621
title: Make the web task list fit without horizontal scroll and trim page padding
status: To Do
assignee: []
created_date: '2026-08-09 19:02'
updated_date: '2026-08-09 19:38'
labels: []
dependencies: []
ordinal: 259000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported by Alex 2026-08-09 with screenshots. The All Tasks table in the web UI is wider than its content needs and shows a horizontal scrollbar even on a Mac laptop screen. A second screenshot highlights a large empty gutter between the collapsed sidebar and the page content. Goal: the task list page fits a typical Mac laptop viewport (around 1440x900 and 1512x982) without horizontal scroll. Owner explicitly allows reducing padding across all pages if needed ("we could also make all pages have less padding if needed"). Constraint: do not remove or hide table columns; fit through width allocation, padding, and layout, not through feature changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The All Tasks table shows no horizontal scrollbar at 1440x900 and 1512x982 viewports with the sidebar expanded and collapsed
- [ ] #2 The gutter between the collapsed sidebar and page content is visibly reduced
- [ ] #3 No table columns are removed or hidden; all pages remain usable at the same viewports
- [ ] #4 Before and after screenshots at the target viewports are included in the PR
- [ ] #5 All scrollbars across the web UI (page, tables, modals, dropdowns) use a subtle themed style: transparent track, thin theme-matched thumb, in both Chromium and Firefox
- [ ] #6 The task detail modal is visually distinguishable from the page behind it via a subtle border and/or shadow, in both color themes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope extended by Alex 2026-08-09: also restyle scrollbars site-wide (invisible track, subtle thumb) - the default bright scrollbar is visible in modals per his screenshot.

Scope extended again by Alex 2026-08-09 (screenshot): the task detail modal blends into the dark backdrop; add a light border or shadow so the modal reads as a distinct surface.
<!-- SECTION:NOTES:END -->
