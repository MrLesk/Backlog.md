---
id: BACK-498
title: Auto-populate actualStart and actualEnd on task creation
status: Done
assignee: []
created_date: '2026-05-29 10:57'
updated_date: '2026-05-29 10:59'
labels: []
dependencies: []
ordinal: 156400
actual_start: '2026-05-29 10:57'
actual_end: '2026-05-29 10:59'
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
When creating a task directly with --status Done or --status 'In Progress', actualEnd and actualStart were not auto-populated because the auto-fill logic only existed in updateTask (status change path), not in createTask.

## Fix
Added auto-populate logic in createTaskFromInput (src/core/backlog.ts):
- If resolvedStatus is 'In Progress' and no actualStart provided → set actualStart = createdDate
- If resolvedStatus is terminal (e.g. Done) and no actualEnd provided → set actualEnd = createdDate

## Behavior
- Manual --actual-start / --actual-end flags still take precedence
- Only fills when the field is absent
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Auto-populate actualStart/actualEnd when tasks are created directly in In Progress or Done status. Logic added to createTaskFromInput in core/backlog.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
