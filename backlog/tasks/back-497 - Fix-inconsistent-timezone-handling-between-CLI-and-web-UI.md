---
id: BACK-497
title: Fix inconsistent timezone handling between CLI and web UI
status: Done
assignee: []
created_date: '2026-05-29 10:43'
updated_date: '2026-05-29 10:53'
labels: []
dependencies: []
ordinal: 155400
planned_start: '2026-05-29'
planned_end: '2026-05-30'
actual_start: '2026-05-29 09:47'
actual_end: '2026-05-29 10:53'
---

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Problem
CLI writes UTC timestamps (e.g. '2026-05-29 10:32'), but various places in the codebase used new Date(dateStr) which browsers/Node.js interpret as LOCAL time for strings without 'Z' or 'T'. This caused:
- TaskDetailsModal showing correct local time (via parseStoredUtcDate)
- DraftsList / board / statistics showing wrong time (via new Date)
- Gantt chart displaying raw UTC time instead of local time

## Changes
1. Extracted parseStoredUtcDate + getStoredUtcTimestamp to src/utils/date-utc.ts (shared between CLI and web)
2. Fixed web components: DraftsList.tsx, CleanupModal.tsx, GanttView.tsx
3. Fixed core modules: board.ts, statistics.ts, task-loader.ts, backlog.ts
4. All datetime parsing now consistently treats stored strings as UTC

## Files modified
- src/utils/date-utc.ts (new)
- src/web/utils/date-display.ts
- src/web/components/DraftsList.tsx
- src/web/components/CleanupModal.tsx
- src/web/components/GanttView.tsx
- src/board.ts
- src/core/statistics.ts
- src/core/task-loader.ts
- src/core/backlog.ts
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed inconsistent timezone handling by unifying all stored datetime parsing to treat strings as UTC. Created shared date-utc.ts utility and updated 9 files across web and core modules. Type-check passes, relevant tests pass, and Gantt chart now correctly displays local time.
<!-- SECTION:FINAL_SUMMARY:END -->
