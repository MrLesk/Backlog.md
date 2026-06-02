---
id: BACK-495.2
title: Implement dual-layer Gantt bar rendering (actual + plan border)
status: Done
assignee: []
created_date: '2026-05-28 08:32'
updated_date: '2026-05-29 18:14'
labels:
  - gantt
  - web-ui
  - frontend
milestone: m-7
dependencies:
  - BACK-495.1
references:
  - src/web/components/GanttView.tsx
parent_task_id: BACK-495
priority: high
ordinal: 38400
actual_start: '2026-05-28 17:16'
actual_end: '2026-05-28 17:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the dual-layer Gantt bar: bottom layer draws solid color bars based on actual time (status-colored), top layer draws plan borders with 60-degree hatched lines. Light mode: white 2px shadow + gray 1px border. Dark mode: gray 2px shadow + white 1px border. Plan and actual bars are independently positioned on the same row with z-axis overlay. Plan borders respect the showPlanTime toggle state.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Gantt Bar Rendering: Dual-Layer Structure

Each task row draws two independently positioned elements at the same y coordinate, stacked on the z-axis:

### Bottom Layer: Actual Task Bar (Solid Fill)

- Time coordinates: based on actualStart → actualEnd (or fallback creation/update time), independently calculating x position and width
- Style: solid rectangle, color varies by task status
  - In Progress → blue-500
  - Done / Completed → emerald-500
  - To Do → gray-400 / dark:gray-500
  - Blocked → red-500
  - Cancelled → gray-300 / dark:gray-600
- Border radius: same as existing bars (rounded-md)
- Height: 60%–70% of row height, vertically centered

### Top Layer: Plan Border (Hatched Fill)

- Time coordinates: based on plannedStart → plannedEnd, independently calculating x position and width
- If a task has no planned time, do not draw the plan border layer
- The plan border consists of two overlapping border layers at the exact same time coordinates:

#### a. Thick Border (Shadow Layer)
- Line width: 2px
- Fill: evenly spaced 6px, -60° slanted line pattern
- Light mode: white thick border creating depth shadow on light background
- Dark mode: gray thick border creating depth shadow on dark background

#### b. Thin Border (Final Plan Line)
- Position: fully overlapping with thick border
- Line width: 1px
- Fill: evenly spaced 6px, -60° slanted line pattern
- Light mode: gray thin border as the final visible plan line
- Dark mode: white thin border as the final visible plan line

### Z-Axis Overlay Effects

The actual bar is drawn first on the bottom layer, and the plan border is drawn on top. Both are independently positioned according to their own time coordinates, naturally presenting the following deviation relationships:

| Deviation Scenario | Condition | Visual Result |
|---|---|---|
| Early start | actualStart < plannedStart | Actual bar starts before the plan border on the left; left overflow is solid color (no hatching), overlap is color + hatching |
| Normal | actualStart = plannedStart and actualEnd ≤ plannedEnd | Actual bar starts at the left edge of the plan border and extends inside; visible area is color + hatching, unreached tail is pure hatching |
| Delay | actualEnd > plannedEnd | Actual bar exceeds the plan border on the right; right overflow is solid color (no hatching), overlap is color + hatching |

### Drawing Behavior for Three Data States

| Data State | Actual Bar | Plan Border | Visual Description |
|---|---|---|---|
| Only creation/update time (no planned time) | ✓ Drawn by createdDate / updatedDate | ✗ Not drawn | Solid color bar, consistent with existing logic |
| Has planned time, no actualStart / actualEnd | ✓ Drawn by createdDate / updatedDate (or minimum width fallback) | ✓ Drawn by planned time | A very short actual bar inside (or next to) the plan border |
| Has planned time + actualStart / actualEnd | ✓ Drawn by actual time positioning | ✓ Drawn by planned time positioning | Both independently positioned, z-axis overlay shows deviation |
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added planPositions useMemo to calculate plan border coordinates based on plannedStart/plannedEnd independently from actual bars.
- Split task bar rendering into two layers: actual bars (bottom, status-colored solid) and plan borders (top, hatched lines with -60deg repeating-linear-gradient).
- Plan border styling: light mode uses white 2px border (outer) + gray 1px border (inner); dark mode uses gray 2px border (outer) + white 1px border (inner).
- Both layers independently positioned on same row with z-axis overlay; overlapping area shows color+hatched pattern, non-overlapping shows pure color or pure hatching.
- Plan border layer has pointer-events-none so hover/click interactions work on actual bar layer.
- Fallback tasks (no actualEnd) use minWidth fallback; non-fallback tasks use real duration with 4px minimum for visibility.
- Status legend dynamically renders all unique statuses from current tasks with original casing.
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
- [x] #1 Dual-layer rendering: actual bars (bottom, status-colored) + plan borders (top, hatched)
- [x] #2 Plan borders use -60deg repeating-linear-gradient with 2px outer + 1px inner borders
- [x] #3 Light/dark mode border colors invert correctly (white/gray vs gray/white)
- [x] #4 z-axis overlay correctly visualizes early start, normal progress, and delay deviations
- [x] #5 Plan border layer uses pointer-events-none so clicks pass through to actual bars
- [x] #6 Fallback tasks use minWidth兜底; non-fallback tasks render real duration with 4px minimum
- [x] #7 Status legend dynamically groups all unique statuses with original casing
<!-- AC:END -->
