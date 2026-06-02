---
id: BACK-495
title: Implement tracking Gantt view with plan vs actual comparison
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-28 08:32'
updated_date: '2026-05-29 18:14'
labels:
  - gantt
  - web-ui
  - frontend
  - tracking
milestone: m-7
dependencies:
  - BACK-495.1
  - BACK-495.2
  - BACK-495.3
  - BACK-495.4
references:
  - src/web/components/GanttView.tsx
  - src/web/App.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
priority: high
ordinal: 153400
planned_start: '2026-05-28'
planned_end: '2026-05-29'
actual_start: '2026-05-28 16:58'
actual_end: '2026-05-28 18:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a tracking Gantt view to the Backlog.md Web UI that simultaneously displays planned time ranges (hatched border) and actual task progress (solid color bar) on the same row, enabling visual deviation tracking for early starts, normal progress, and delays.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Tracking Gantt Design

## Background

Backlog.md task data has three time states:

1. **Newly created tasks**: only createdDate, no planned or actual time
2. **Planned but not executed / in-progress tasks**: have plannedStart / plannedEnd, possibly with actualStart / actualEnd
3. **Completed tasks**: have both planned and actual time

Field evolution: BACK-491 only had plannedStart / plannedEnd / createdDate / updatedDate. actualStart / actualEnd were added later; the system auto-writes actualStart when status changes to "in progress" and actualEnd when status reaches a terminal state.

The existing Gantt (BACK-491) draws all tasks as single-color bars using resolved effective time, making it impossible to distinguish "planned" vs "actual" or visually track progress deviations. This design introduces a **Tracking Gantt** that displays both planned and actual ranges on the same row.

## Architecture

- Left table time columns always display actual time
- Gantt bars use a dual-layer structure: bottom actual bar (solid fill) + top plan border (hatched fill)
- Dependency arrows use smart time resolution for connection points
- Tooltip shows both planned and actual time
- Legend explains all visual elements

## Task Breakdown

- BACK-495.1: Left table + time resolution engine
- BACK-495.2: Dual-layer Gantt bar rendering (actual + plan border)
- BACK-495.3: Tooltip, legend, and interaction enhancements
- BACK-495.4: Smart dependency arrow time resolution
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Designed the overall tracking Gantt solution, supporting simultaneous display of planned and actual ranges on the same row.
- Clarified drawing rules for three data states: creation time only / planned but no actual / planned with actual.
- Defined dual-layer structure: bottom actual bar (status-colored solid fill) + top plan border (60° hatched fill).
- Defined smart dependency arrow connection point selection logic.
- Designed tooltip, legend, and interaction enhancements.
- Defined minimum width fallback strategy (day view 4h, week/month 1d, quarter/year 8px).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tracking Gantt view is functional in the Web UI with plan vs actual comparison
- [x] #2 All subtasks (BACK-495.1 ~ BACK-495.4) are completed, merged, and verified
<!-- AC:END -->
