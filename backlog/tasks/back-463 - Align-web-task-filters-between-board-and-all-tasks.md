---
id: BACK-463
title: Align web task filters between board and all tasks
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-03 19:15'
updated_date: '2026-05-03 19:15'
labels:
  - web
  - filters
  - bug
dependencies: []
modified_files:
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/test/web-task-list-labels-menu.test.tsx
  - src/test/web-board-filters.test.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to manual BACK-441 testing. Remove the duplicate local free-text `Search tasks` input from the All Tasks page because the web UI already has global sidebar search. Reuse the All Tasks dropdown visual treatment for the Kanban board assignee, label, and priority filters, and place those board filters inline next to the `All Tasks` / `Milestone` lane mode switch instead of in a separate smaller filter row.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All Tasks no longer renders a local `Search tasks` input or writes `query` from that page's local controls.
- [ ] #2 All Tasks structured filters for status, priority, milestone, labels, cleanup, and clear filters still work.
- [ ] #3 Kanban board assignee, label, and priority filters use the same dropdown sizing/style family as the All Tasks page controls.
- [ ] #4 Kanban board filters sit beside the `All Tasks` / `Milestone` lane mode switch and keep URL persistence for `assignee`, `label`, and `priority`.
- [ ] #5 Focused web tests cover the removed All Tasks search input and the board filter placement/styling behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Commit the BACK-463 task file to `main` by itself, then branch for code changes.
2. In `TaskList.tsx`, remove the local `Search tasks` input, its state, and `query` URL/search plumbing only; leave status, priority, milestone, label, cleanup, and clear-filter behavior intact.
3. In `Board.tsx`, move assignee/label/priority filter controls into the header group beside the lane mode segmented control and reuse the All Tasks dropdown classes (`h-10`, `rounded-lg`, gray border, stone focus ring, matching text/background colors). Keep clear filters nearby without changing URL semantics.
4. Update focused tests for the missing All Tasks search input and board filters being inline/styled like All Tasks controls.
5. Run targeted web tests, typecheck, Biome, and a local source browser/server smoke before opening the PR.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
