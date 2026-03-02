---
id: BACK-399
title: Refactor TUI filter UX parity between task list and kanban
status: Done
assignee:
  - '@codex'
created_date: '2026-03-01 20:09'
updated_date: '2026-03-01 20:54'
labels:
  - cli
  - tui
  - enhancement
dependencies: []
references:
  - /Users/alex/projects/Backlog.md/src/ui/task-viewer-with-search.ts
  - /Users/alex/projects/Backlog.md/src/ui/components/filter-header.ts
  - /Users/alex/projects/Backlog.md/src/ui/unified-view.ts
  - /Users/alex/projects/Backlog.md/src/utils/task-search.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve the interactive TUI filtering experience so users can use a consistent filter workflow in both the task list and kanban views, and navigation between the filter bar and task rows behaves predictably at list boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Kanban view exposes the same filter set as task list for search, priority, labels, and milestone (status remains task-list only).
- [x] #2 In both task list and kanban views, filter controls use the popup interaction pattern used by the labels filter today.
- [x] #3 In task list view, keyboard navigation treats the filter bar as a virtual row: Up from the first task moves focus to the search filter, and Up again wraps to the last task.
- [x] #4 In task list view, Down from the last task moves focus to the search filter, and Down again wraps to the first task.
- [x] #5 Filter results remain consistent between task list and kanban for shared filters (search, priority, labels, milestone).
- [x] #6 Automated tests cover the new filter behavior in kanban and the boundary navigation behavior between list rows and filter bar.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Classify scope as L2 (cross-module TUI behavior) and keep a single shared filtering implementation as source of truth to prevent drift between task list and kanban.
2. Add shared filter application utilities in `src/utils/task-search.ts` for search/priority/labels/milestone (+ optional status toggle), and reuse them from both list and kanban paths so shared filters always return identical results.
3. Refactor `src/ui/components/filter-header.ts` so non-search filters follow the labels-style popup workflow (status, priority, milestone, labels all open popup pickers instead of inline selector navigation), while preserving live search behavior and focus notifications.
4. Update `src/ui/task-viewer-with-search.ts` to consume the popup-first header API, centralize picker rendering for all filter types, and implement virtual-row boundary navigation:
   - Up on first task row focuses Search.
   - Up again from Search wraps to last task.
   - Down on last task row focuses Search.
   - Down again from Search wraps to first task.
5. Update `src/ui/unified-view.ts` to maintain canonical filter state, apply shared filters for the kanban data stream (shared filters only; status remains task-list-only), and keep board updates in sync with filter changes.
6. Extend kanban interaction surface to expose the same shared filter set and popup picker pattern required by ACs (search/priority/labels/milestone). This likely requires coordinated updates where kanban key handling and footer help are defined.
7. Add/adjust automated tests:
   - `src/test/unified-view-filters.test.ts` for shared filter/state behavior and status exclusion in kanban path.
   - New/updated tests for boundary navigation logic between task list and filter bar (pure helper-focused where possible).
   - Targeted kanban filter behavior tests validating shared-filter parity with task list.
8. Validate with scoped checks first, then broader checks: `bun test` (targeted + affected suites), `bunx tsc --noEmit`, and `bun run check .` for touched files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refactored TUI filter controls to popup interaction pattern by converting status/priority/milestone controls from inline selectors to popup buttons in FilterHeader, matching labels behavior.

Added shared filtering utilities in task-search (applyTaskFilters/applySharedTaskFilters) and wired kanban/task-list filtering paths to the same search+priority+labels+milestone semantics.

Implemented virtual-row boundary navigation in task viewer: list boundary up/down now hands off to search, and directional exit from search resolves to last/first row when boundary wrap is pending.

Extended kanban board UI to render filter header (search/priority/milestone/labels, status omitted), open popups for non-search filters, and keep unified-view filter state synchronized via onFilterChange callbacks.

Added automated coverage: new task-viewer boundary navigation tests plus unified-view filter tests for kanban status exclusion and shared-filter parity.

Verification run: bunx tsc --noEmit, bun run check ., targeted + broader test suites (28 tests across 7 files), and CLI smoke commands for board/task-list flows completed successfully.

Opened PR: https://github.com/MrLesk/Backlog.md/pull/553
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented TUI filter UX parity between task list and kanban, including popup-based filter controls and boundary navigation parity updates.

What changed:
- Refactored `FilterHeader` to a popup-first control model for non-search filters (status/priority/milestone/labels) with reusable focus/exit handling.
- Added shared popup helpers in `src/ui/components/filter-popup.ts` and reused them across task list and kanban flows.
- Added shared filtering utilities in `src/utils/task-search.ts` (`applyTaskFilters`, `applySharedTaskFilters`) to keep search/priority/labels/milestone behavior consistent.
- Updated task viewer to use popup controls and implemented virtual-row boundary behavior:
  - Up from first list row -> search filter
  - Up from search after boundary handoff -> last row
  - Down from last list row -> search filter
  - Down from search after boundary handoff -> first row
- Extended kanban board TUI to render a filter header with shared filters only (search/priority/labels/milestone), while keeping status task-list-only.
- Wired unified view filter state synchronization between task list and kanban without reintroducing status filtering in kanban.
- Added targeted tests for kanban shared-filter parity and task-viewer boundary navigation.

Verification evidence:
- `bunx tsc --noEmit` passed.
- `bun run check .` passed.
- `bun test src/test/unified-view-filters.test.ts src/test/task-viewer-boundary-navigation.test.ts src/test/task-search-label-filter.test.ts src/test/unified-view-loading.test.ts src/test/tab-switching.test.ts src/test/view-switcher.test.ts src/test/board-command.test.ts` passed (28 tests).
- `bun test src/test/task-viewer-milestone-filter-model.test.ts` passed.
- CLI smoke checks executed successfully:
  - `bun run cli board > /tmp/back399-board.txt`
  - `bun run cli task list --plain --priority high > /tmp/back399-task-list-priority.txt`

PR:
- https://github.com/MrLesk/Backlog.md/pull/553
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
