---
id: BACK-552
title: Show acceptance criteria progress on browser task summaries
status: Done
assignee:
  - '@codex'
created_date: '2026-07-17 21:36'
updated_date: '2026-08-10 05:39'
labels: []
dependencies: []
modified_files:
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/TaskList.tsx
  - src/test/web-task-acceptance-progress.test.tsx
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
- [x] #1 In Progress task summaries or cards with acceptance criteria show a compact segmented completion bar followed by the exact checked/total fraction, without an AC label or percentage
- [x] #2 The displayed completion is derived from the task current checked and total acceptance criteria and reflects acceptance-criteria changes without storing a separate progress value
- [x] #3 The browser uses a 10-cell bar when space allows and a 5-cell bar in narrower available space, preserving the desktop-first layout and best-effort narrow behavior
- [x] #4 An In Progress task with no acceptance criteria does not display a value that implies 0% completion
- [x] #5 An In Progress task with every acceptance criterion checked remains visibly In Progress and the completion display does not imply that its task status is Done
- [x] #6 Browser tests cover partial completion, no acceptance criteria, all criteria checked while In Progress, and the 10-cell and 5-cell layouts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one shared browser acceptance-progress component that derives checked and total counts directly from Task.acceptanceCriteriaItems, renders only for In Progress tasks with criteria, and supports explicit 5-cell and 10-cell layouts.
2. Integrate the 5-cell layout into constrained board cards and the 10-cell layout into task-list title summaries without changing Task, CLI, MCP, or API schemas.
3. Add focused rendered tests for partial progress, no criteria, all criteria checked while In Progress, both cell counts, and rerendered criterion changes; then run targeted tests, typecheck, Biome, and rendered browser QA.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared browser-only AcceptanceCriteriaProgress component that derives checked/total directly from Task.acceptanceCriteriaItems. Board cards use 5 cells and task-list summaries use 10 cells. It renders only for normalized In Progress status with at least one criterion; a full bar stays blue while the existing task status remains visible. No Task, API, CLI, MCP, or persisted progress field changed.

Final validation: the rendered web slice passed 11/11, covering exact 4/7 output at both cell counts, absent criteria, all criteria checked with an In Progress status cell, and recalculation after updated task props. bunx tsc --noEmit, bun run check ., and bun run build passed.

In-app Browser QA was attempted against a controlled local project and the source server started successfully, but this session exposed no connected browser backend, so no visual screenshot was available. A full bun run test attempt reached unrelated failures: the existing TUI composer watcher-delivery case timed out, and sandboxed loopback-listener tests failed with EPERM. The scoped test path permitted by the Definition of Done is green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added derived acceptance-criteria progress to In Progress browser summaries: five cells on board cards and ten cells in the task list, with exact checked/total counts and no persistence or public-surface changes. Verified partial, empty, complete, and updated states with 11 rendered web tests; TypeScript, Biome, and the production build pass.
<!-- SECTION:FINAL_SUMMARY:END -->
