---
id: BACK-495.3
title: 'Add tooltip, legend and interaction enhancements for tracking Gantt'
status: Done
assignee: []
created_date: '2026-05-28 08:33'
updated_date: '2026-05-29 18:23'
labels:
  - gantt
  - web-ui
  - frontend
milestone: m-7
dependencies:
  - BACK-495.2
references:
  - src/web/components/GanttView.tsx
parent_task_id: BACK-495
priority: medium
ordinal: 39400
actual_start: '2026-05-28 17:09'
actual_end: '2026-05-28 17:12'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enhance hover tooltip to display both planned and actual time ranges with deviation analysis. Add click highlighting that includes plan border layer. Add a legend to the toolbar explaining solid bars = actual time, hatched borders = planned time, arrows = dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Interaction Adjustments

### Hover Tooltip

Hovering over a task bar displays both planned and actual time:

- Task ID and title
- Planned time range (plannedStart → plannedEnd)
- Actual time range (actualStart → actualEnd, with fallback indicator)
- Status, priority, and other metadata

### Click Highlighting

- After clicking a task bar, highlighting logic remains unchanged (upstream/downstream tasks + dependency arrows highlighted, others dimmed to 30%)
- Plan border layer participates in highlighting/dimming together

### Legend

Add a legend to the Gantt toolbar explaining:
- Solid color bars = actual task time (grouped by status)
- Hatched border = planned time range
- Arrow = task dependency
- Yellow * = estimated/fallback time (used when no actualEnd exists)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Enhanced hover tooltip to display planned time range (when available) and actual time range with fallback indicator.
- Click highlighting works on both actual bar and plan border layers via shared opacity state.
- Added legend to toolbar showing: status-colored bars grouped by actual status, hatched border = Planned, arrow = Dependency, amber * = Fallback/estimated time.
- Added fallback legend entry with amber bold asterisk.
- Chinese i18n: fallback label changed from fallback to estimate.
- Sort icons repositioned to the right of header labels with vertical centering.
- Chinese/Japanese/English header labels use two-line layout (e.g., Planned\nStart, Actual\nStart).
- Default sort changed to ID desc; default view changed to day.
- Auto-select first task on load; auto-scroll timeline to selected task when switching views.
- Selected task background deepened from bg-blue-50 to bg-blue-100.
- Type-check and lint pass.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tooltip displays planned range, actual range, and fallback indicator on hover
- [x] #2 Click highlighting applies to both actual bars and plan borders
- [x] #3 Legend shows status bars (grouped), plan border, dependency arrow, and fallback asterisk
- [x] #4 Header labels use two-line layout; sort icons are right-aligned and vertically centered
- [x] #5 Default view is day granularity with ID descending sort
- [x] #6 First task auto-selected on load; timeline auto-scrolls to selected task on view switch
- [x] #7 Selected task background is visually distinct (bg-blue-100 dark:bg-blue-900/40)
<!-- AC:END -->
