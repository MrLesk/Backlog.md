---
id: BACK-387
title: Hide Done tasks from Unassigned group on Milestones page
status: To Do
assignee:
  - '@codex'
created_date: '2026-02-17 20:31'
updated_date: '2026-02-17 20:31'
labels: []
milestone: m-6
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Web Milestones page so the Unassigned tasks group does not display tasks with Done status. This should reduce noise and keep unassigned work focused on active/pending items while preserving existing milestone grouping behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unassigned tasks group on the Milestones page excludes tasks whose status is Done.
- [ ] #2 Unassigned task count reflects only non-Done tasks after filtering.
- [ ] #3 Milestone-assigned groups keep their current behavior and are not regressed by this change.
- [ ] #4 If all unassigned tasks are Done, the Unassigned group shows an appropriate empty state instead of listing Done tasks.
- [ ] #5 Web tests cover filtering and count behavior for Done vs non-Done unassigned tasks.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
