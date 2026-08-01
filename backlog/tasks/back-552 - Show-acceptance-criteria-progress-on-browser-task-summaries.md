---
id: BACK-552
title: Show acceptance criteria progress on browser task summaries
status: To Do
assignee: []
created_date: '2026-07-17 21:36'
labels: []
dependencies: []
type: feature
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Help people scan implementation progress in the browser by showing acceptance-criteria completion on task summaries or cards for tasks that are In Progress. The compact display combines a segmented bar with the exact checked/total fraction, for example [██████░░░░] 4/7. It does not show an AC label or a percentage. The value is derived from the task acceptance criteria and is not persisted separately.

This task covers the browser only. CLI and MCP output are out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In Progress task summaries or cards with acceptance criteria show a compact segmented completion bar followed by the exact checked/total fraction, without an AC label or percentage
- [ ] #2 The displayed completion is derived from the task current checked and total acceptance criteria and reflects acceptance-criteria changes without storing a separate progress value
- [ ] #3 The browser uses a 10-cell bar when space allows and a 5-cell bar in narrower available space, preserving the desktop-first layout and best-effort narrow behavior
- [ ] #4 An In Progress task with no acceptance criteria does not display a value that implies 0% completion
- [ ] #5 An In Progress task with every acceptance criterion checked remains visibly In Progress and the completion display does not imply that its task status is Done
- [ ] #6 Browser tests cover partial completion, no acceptance criteria, all criteria checked while In Progress, and the 10-cell and 5-cell layouts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
