---
id: BACK-491
title: Add Smart Gantt View
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-27 02:05'
updated_date: '2026-05-28 00:35'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/web/App.tsx
  - src/web/components/GanttView.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
priority: high
ordinal: 35400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a Gantt timeline view to the Backlog.md Web UI, rendered purely with React/CSS based on existing date fields and dependency relationships, to fill the gap in project time-dimension visualization.

## Background

The current Backlog.md task model already contains a large amount of real business data:
- Required fields: task ID (id), task title (title), creation time (createdDate)
- Optional fields: planned start time (plannedStart), planned end time (plannedEnd), update time (updatedDate), task dependency relationships (dependencies)

The existing system lacks timeline visualization capabilities, with the following problems:
1. Most existing tasks have no planned dates, only creation/update times, making it impossible to visually inspect task cycles
2. A small number of planned tasks have clear start/end times, but cannot be visualized in a schedule
3. Task dependency relationships are recorded as plain text, with no graphical linkage, making it difficult to identify critical paths
4. Lack of a global time view, unable to quickly switch between day/week/month/quarter/year to observe project rhythm

## Goals

1. Add a /gantt route page with a standard layout of task list on the left + timeline on the right
2. Establish automated time value resolution rules, compatible with unplanned tasks that only have createdDate
3. Support 5 levels of time granularity switching: Day / Week / Month / Quarter / Year
4. Solve the display problem where single-date tasks are compressed into thin lines in large-span views
5. Support task dependency visualization arrows based on dependencies
6. Automatically apply a minimum width fallback for tasks without planned start/end times to ensure interface interactivity

## Page Layout

### Left: Five-Column Fixed Table
- Task ID
- Task Title
- Start Time (resolved effective start time)
- End Time (resolved effective end time)
- Action (Detail button, click to open task detail modal)
- Header sorting: the first four columns support click sorting, only changing frontend display order without affecting actual task data. Sorting interaction is consistent with the "All Tasks" page: double-arrow icons (↑/↓), inactive gray, active highlight, three-state equal-width borders to avoid header jitter.

### Right: Dynamic Gantt Timeline Area
- Top time granularity switcher (Day / Week / Month / Quarter / Year)
- Dynamic scale timeline
- Task time bar rendering (based on resolved start/end times)
- Task dependency arrow overlay (SVG or CSS)

## Core: Task Start/End Time Resolution Rules (Mandatory Priority)

### Start Time Resolution Rules
1. If plannedStart exists → use planned start time first
2. If no planned start time → use the date part of createdDate (YYYY-MM-DD)

### End Time Resolution Rules
1. If plannedEnd exists → use planned end time first
2. If no planned end time but updatedDate exists → use the date part of updatedDate (YYYY-MM-DD)
3. If only createdDate exists (no planned time and no update time) → enable dynamic minimum width fallback

## Minimum Width Fallback Mechanism (Solving Single-Point Task Compression)

Prohibit tasks from rendering as 0 width under any view, adopting a "view-granularity-matched dynamic duration fallback" strategy:
- Day view: fallback minimum duration = 4 hours (visual width, facilitating vertical staggering of multiple tasks on the same day)
- Week view: fallback minimum duration = 1 day
- Month view: fallback minimum duration = 1 day
- Quarter / Year view: fallback fixed visual pixel width (ensuring visible color blocks, e.g. 8px)

Fallback logic: only automatically filled when a task has only creation time (no plannedStart/End, no updatedDate), without affecting normal tasks with complete planned times or update times.

Note: The "4 hours" in day view is a pure frontend visual strategy. Since date fields are Date-only, the frontend renders single-day tasks with an offset from the day's start and a duration of approximately 4 hours visual width, allowing multiple tasks on the same day to be vertically staggered without completely overlapping.

## Same-Day Multi-Task Rendering Rules

1. Tasks with only creation time in day view: naturally form horizontal staggering through dynamic minimum width (approximately 4 hours visual width), avoiding complete overlap of same-day tasks
2. No horizontal squeezing, ensuring multiple tasks can be distinguished in detailed views
3. Automatic visual hierarchy aggregation in large-span views to keep the interface clean

## Time Granularity Switching

Supports 5 levels of one-click switching:
- Day view: suitable for viewing dense development task arrangements in recent days
- Week view: suitable for iteration progress review
- Month view: suitable for monthly project retrospectives
- Quarter view: suitable for medium/long-term project overviews
- Year view: suitable for annual project big-picture overview

Switching characteristics:
- Automatically recalculates task positions and minimum widths when switching granularity
- Timeline scale, step size, and zoom ratio automatically adapt
- Hover detail tooltips automatically enabled in large-span views

## Task Dependency Visualization (Simple Network Diagram)

1. Read the Task's dependencies field (predecessor task ID list)
2. Overlay arrow connection lines on top of the Gantt layer (SVG absolute positioning overlay)
3. Connection rule: predecessor task end position → successor task start position
4. Multiple dependencies automatically stagger to prevent tangling (Bezier curves or polylines)
5. Dependency arrows adaptively follow time granularity scaling

## Interaction Details

1. Task bar hover: display complete information (ID, title, start/end time, whether fallback rendering)
2. Single-point task hover in large-span views: display real planned time (if any)
3. Support clicking task bars to highlight their dependency chain (predecessor/successor tasks highlighted, others faded to 30%)
4. Timeline supports drag-to-pan (swipe left/right to view more time)
5. Left table "Detail" button click opens task detail modal (reusing existing TaskDetailsModal)
6. Left table sorting state changes, right Gantt bars re-layout according to new order

## Input Data (Fully Reuses Existing Fields, No New Fields Needed)

- id — Task ID
- title — Task Title
- plannedStart — Planned start time (optional, Date-only)
- plannedEnd — Planned end time (optional, Date-only)
- createdDate — Creation time (required, YYYY-MM-DD HH:MM)
- dependencies — Predecessor task ID list (optional, string[])
- status — Task status
- priority — Priority
- milestone — Associated milestone

## Engineering Requirements

1. Route registration: add /gantt route in src/web/App.tsx
2. Navigation entry: add "Gantt" navigation item in src/web/components/SideNavigation.tsx
3. Internationalization: supplement all new UI text key-values in src/web/locales/{en,ja,zh-CN,zh-TW}.ts
4. Theme adaptation: all colors use Tailwind CSS dark: variants, supporting dark mode
5. Component location: create new src/web/components/GanttView.tsx (main page) and necessary sub-components

## Out of Scope

1. No new database/fields
2. No manual drag-to-change time support (future iteration)
3. No complex critical path calculation (future iteration)
4. No external Gantt chart library introduced (keep pure React/CSS rendering)

This feature is a pure frontend visualization enhancement, without modifying any underlying data structures. The technical solution follows existing wiki decisions: pure React/CSS rendering based on resolved start time, end time, and task dependency relationships.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Five-level time granularity switching works normally, view adapts without errors
- [x] #2 All time boundary scenarios render correctly (plannedStart/End, createdDate/updatedDate, createdDate-only fallback)
- [x] #3 Same-day multiple tasks do not overlap, independently interactive
- [x] #4 Task dependency arrows display accurately and follow zoom scaling
- [x] #5 Single-point tasks remain visible in year/quarter views, do not disappear, hover info correct
- [x] #6 Left list info and right Gantt bar time resolution logic completely consistent
- [x] #7 All elements visually normal in dark mode
- [x] #8 Left table detail button click correctly opens existing task detail modal, clicking task bar highlights dependency chain
- [x] #9 Left table four-column sorting works normally, right Gantt bars re-layout after sorting
- [x] #10 Same-day multiple tasks in day view horizontally stagger through dynamic minimum width, independently clickable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create GanttView.tsx main component: implement left task list table + right timeline dual-panel layout, including five-level granularity switching, task bar rendering, dependency arrow SVG overlay, hover tooltip, drag-to-pan, Today marker line, and other complete interactions.
2. Register /gantt route in App.tsx and pass tasks and onEditTask.
3. Add "Gantt" navigation entry in SideNavigation.tsx (expanded/collapsed two forms) and dedicated icon.
4. Add /gantt to server route table index.ts to support SPA direct refresh.
5. Supplement gantt namespace internationalization key-values in en/ja/zh-CN/zh-TW four languages.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Pure React/CSS rendering, zero external Gantt chart library dependencies.
- Time resolution priority: plannedStart → createdDate; plannedEnd → updatedDate → createdDate+1d (fallback).
- Fallback tasks marked with * in list, tooltip labeled fallback.
- Day view pxPerDay=90, tasks with only creation time naturally form horizontal staggering through dynamic minimum width, avoiding complete overlap of same-day tasks.
- Dependency arrows use SVG cubic-bezier, horizontal lead-in + curve + arrow, supporting click-to-highlight upstream/downstream chain (other tasks/arrows faded to 30%).
- Timeline drag-to-pan calculates deltaDays via mouse events to derive viewStart/viewEnd; left and right panel scroll events synchronized bidirectionally.
- Header sorting reuses "All Tasks" double-arrow interaction pattern, right Gantt bars recalculate positions after sortedTasks updates.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
