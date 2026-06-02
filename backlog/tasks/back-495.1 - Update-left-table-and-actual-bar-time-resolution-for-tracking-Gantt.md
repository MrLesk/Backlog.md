---
id: BACK-495.1
title: Update left table and actual bar time resolution for tracking Gantt
status: Done
assignee: []
created_date: '2026-05-28 08:32'
updated_date: '2026-05-29 18:14'
labels:
  - gantt
  - web-ui
  - frontend
milestone: m-7
dependencies: []
references:
  - src/web/components/GanttView.tsx
parent_task_id: BACK-495
priority: high
ordinal: 37400
actual_start: '2026-05-28 17:15'
actual_end: '2026-05-28 17:16'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify the left table to display four time columns (Planned Start, Planned End, Actual Start, Actual End). Add a toggle switch in the toolbar to show/hide plan time columns. Actual times display with hours/minutes when present; fallback to resolved time with * indicator when absent. Update the underlying time resolution engine in GanttView.tsx to support actualStart/actualEnd as primary fields. Ensure all column headers are properly internationalized.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Left Table Time Column Rules

The "Start Time" and "End Time" columns in the left table always display actual time:

| Priority | Actual Start | Actual End |
|---|---|---|
| 1 | actualStart | actualEnd |
| 2 | createdDate | updatedDate |
| 3 | createdDate | createdDate + 1d (fallback) |

If a task has no actualStart / actualEnd, fallback to creation / update time, consistent with existing logic.

## Time Resolution and Coordinate Calculation

**Actual bar coordinates** (smart time resolution):
1. actualStart → actualEnd (actual time first)
2. If missing → fallback to createdDate / updatedDate
3. If still missing (only createdDate, no updatedDate) → createdDate + minimum width fallback (day view 4h, week/month 1d, quarter/year 8px)

**Plan border coordinates**:
1. plannedStart → plannedEnd
2. If missing → do not draw plan border layer

### Minimum Width Fallback

- Minimum width fallback is only enabled when "no actualStart/actualEnd and no updatedDate"; since createdDate is required, every task has at least creation time
- Fallback strategy is consistent with existing logic (day view 4h, week/month 1d, quarter/year 8px)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Extended ParsedTask interface with plannedStart/plannedEnd fields for plan border rendering.
- Rewrote parseTasks to prioritize actualStart/actualEnd for the left table and actual bar, falling back to createdDate/updatedDate and minimum width.
- Expanded left table from 2 time columns to 4: Planned Start, Planned End, Actual Start, Actual End.
- Added showPlanTime toggle switch in toolbar; plan columns only visible when enabled.
- Added showActualTime toggle switch in toolbar (default on); actual columns can be hidden.
- Dynamic left panel width based on showPlanTime / showActualTime / hasCrossYearTasks.
- formatDisplayDate now shows HH:MM when time component is non-zero; omits time for date-only planned dates.
- Added i18n keys for new columns and toggles in en/ja/zh-CN/zh-TW.
- Fixed parseDate to use T00:00:00 for date-only values, ensuring consistent local-time parsing.
- getTimelineX now accepts snapToDay parameter: plan dates snap to 00:00 in non-day views, actual dates preserve time precision.
- All time columns use truncate to prevent text overflow.
- Cross-year tasks auto-detected; actual columns widen to w-44 (176px) when cross-year tasks exist.
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
- [x] #1 Left table renders 4 time columns (Planned Start, Planned End, Actual Start, Actual End)
- [x] #2 showPlanTime and showActualTime toggles correctly show/hide columns
- [x] #3 Time resolution correctly prioritizes actualStart/actualEnd → createdDate/updatedDate → minimum width fallback
- [x] #4 Cross-year tasks are auto-detected and columns widen to prevent text overflow
- [x] #5 parseDate handles date-only values as T00:00:00 local time without timezone shifts
- [x] #6 getTimelineX supports snapToDay for plan dates while preserving actual time precision
- [x] #7 All time columns use truncate to prevent text overflow
<!-- AC:END -->
