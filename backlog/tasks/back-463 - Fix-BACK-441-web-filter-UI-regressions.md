---
id: BACK-463
title: Fix BACK-441 web filter UI regressions
status: Done
assignee:
  - '@codex'
created_date: '2026-05-03 19:05'
updated_date: '2026-05-03 19:09'
labels:
  - bug
  - web
  - filters
dependencies: []
modified_files:
  - src/web/components/Board.tsx
  - src/web/components/TaskList.tsx
  - src/test/web-board-filters.test.tsx
  - src/test/web-task-list-labels-menu.test.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to BACK-441 after manual release testing. The kanban board filter controls are present in source but not obvious enough in the Web UI, and the All Tasks page now duplicates the global sidebar search with its own local `Search tasks` input. Keep the board-level assignee/label/priority filters and URL persistence, make the board filter affordance visible, and remove the duplicate All Tasks text search while leaving the structured table filters intact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The kanban board clearly exposes board filter controls for assignee, label, and priority.
- [x] #2 Board filter state still reads/writes `assignee`, `label`, and `priority` URL query parameters and clear filters still removes them.
- [x] #3 The All Tasks page no longer renders a local `Search tasks` text input because global search already exists in the sidebar.
- [x] #4 All Tasks structured filters for status, priority, label, milestone, and cleanup behavior keep working.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the existing BoardPage URL-backed assignee/label/priority filter state, but make the Board filter bar visibly labeled and accessible so the kanban filter affordance is obvious during manual testing.
2. Remove the All Tasks local free-text `Search tasks` input and its `query` URL/search plumbing from TaskList, while preserving status, priority, label, milestone, cleanup, and clear-filter behavior.
3. Update focused web tests to assert board filters are visibly exposed and All Tasks no longer renders the duplicate local search input.
4. Run targeted web tests, typecheck, and Biome before opening a PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented follow-up fix: Board filter controls now have a visible `Filters` affordance and accessible labels while preserving BoardPage URL-backed assignee/label/priority params. Removed the duplicate All Tasks local free-text search input and `query` plumbing from TaskList; structured status, priority, label, and milestone filters remain intact.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made BACK-441's board filters visible in the kanban board UI by labeling the filter bar and adding accessible labels for the assignee, label, and priority controls. Removed the duplicate local `Search tasks` input from All Tasks and deleted its `query` URL/search plumbing, leaving global sidebar search as the only free-text search. Preserved All Tasks structured filters and board filter URL persistence.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
