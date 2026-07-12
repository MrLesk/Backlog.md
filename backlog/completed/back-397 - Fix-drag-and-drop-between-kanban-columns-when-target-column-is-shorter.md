---
id: BACK-397
title: Fix drag-and-drop between kanban columns when target column is shorter
status: Done
assignee:
  - '@codex'
created_date: '2026-02-22 17:22'
updated_date: '2026-02-22 17:22'
labels:
  - bug
  - web-ui
  - kanban
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/543'
  - 'https://github.com/MrLesk/Backlog.md/pull/544'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web Kanban drag-and-drop fails when moving a task from a long source column to a shorter adjacent target column unless dropped near the top. Root cause is that TaskColumn did not fill the stretched wrapper height, so onDragOver/onDrop handlers were not reachable across the full visible column area.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In All Tasks mode, dragging from the bottom of a long column to a shorter adjacent column succeeds
- [x] #2 In Milestone mode, target columns accept drops across their full visual height
- [x] #3 TaskColumn root fills its wrapper height so drag events are captured in stretched regions
- [x] #4 Build passes with `bun run build` and tests pass with `bun test` in CI/expected environment
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Linked issue #543 and PR #544. Verified reproduction on main and confirmed fix on PR branch: adding `h-full` to TaskColumn removes wrapper/column height mismatch and restores drop targeting across full column height in both All Tasks and Milestone modes. Verified build and tests for merge gate.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
