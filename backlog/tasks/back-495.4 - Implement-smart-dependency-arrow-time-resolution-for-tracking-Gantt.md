---
id: BACK-495.4
title: Implement smart dependency arrow time resolution for tracking Gantt
status: Done
assignee: []
created_date: '2026-05-28 08:34'
updated_date: '2026-05-29 18:23'
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
ordinal: 40400
actual_start: '2026-05-28 17:07'
actual_end: '2026-05-28 17:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update dependency arrow rendering to use smart time resolution with fallback (actualStart/End -> createdDate/updatedDate -> minimum width). Arrow start point: use actual start if earlier than planned start, otherwise use planned start. Arrow end point: use planned end if resolved end is earlier than planned start, otherwise use resolved end.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Dependency Arrow Drawing Rules

The start and end points of dependency arrows must first go through smart time resolution to obtain the "resolved effective time", then select connection points based on planned time deviation.

### Smart Time Resolution (Arrow-Specific)

**Resolved start time**:
1. If actualStart exists → use actualStart
2. Else if createdDate exists → use createdDate date portion
3. Else → no valid start time (task does not participate in dependency connections)

**Resolved end time**:
1. If actualEnd exists → use actualEnd
2. Else if updatedDate exists → use updatedDate date portion
3. Else if createdDate exists → use createdDate + 1d (minimum width fallback)
4. Else → no valid end time (task does not participate in dependency connections)

### Start Side (Arrow Tail, Connecting Predecessor End)

resolvedEnd = resolved end time (from fallback chain above)

if (resolvedEnd < plannedStart) {
  use plannedEnd as connection point
} else {
  use resolvedEnd as connection point
}

Logic: if the resolved end is earlier than planned start (rare, possibly data anomaly or strongly ahead of schedule), fall back to plannedEnd to maintain dependency chain continuity; otherwise use resolved end.

### End Side (Arrow Head, Connecting Successor Start)

resolvedStart = resolved start time (from fallback chain above)

if (resolvedStart < plannedStart) {
  use resolvedStart as connection point
} else {
  use plannedStart as connection point
}

Logic: if the actual/resolved start is earlier than planned, the arrow should connect to the earlier actual position; otherwise to the planned start position.

### Arrow SVG Drawing Unchanged

- Continue using SVG cubic-bezier curves
- Horizontal entry + curve + arrow style remains unchanged
- Multiple dependencies auto-offset to prevent tangling
- Arrow color in tracking mode uses gray-500 (avoids clashing with status-colored bars)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Implemented smart time resolution for dependency arrow connection points.
- Arrow start point (predecessor end side): uses resolved end time; if resolved end < planned start, falls back to planned end.
- Arrow end point (successor start side): uses resolved start time; if resolved start < planned start, uses resolved start, otherwise uses planned start.
- Arrow color changed to gray-500 to avoid visual conflict with status-colored bars.
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
- [x] #1 Arrow start point uses resolved end; falls back to plannedEnd when resolved < plannedStart
- [x] #2 Arrow end point uses resolved start when earlier than plannedStart, else plannedStart
- [x] #3 Smart time resolution correctly applies fallback chain for arrow connection points
- [x] #4 Arrow color is gray-500 to avoid visual conflict with status-colored bars
- [x] #5 SVG cubic-bezier curves and multi-dependency offset logic remain intact
<!-- AC:END -->
