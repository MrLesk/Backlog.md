---
id: BACK-674
title: Sort the TUI list view through the shared task ID comparator
status: To Do
assignee: []
created_date: '2026-09-01 17:16'
labels: []
dependencies: []
ordinal: 306000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported in https://github.com/MrLesk/Backlog.md/issues/953: with more than nine subtasks, the board orders them numerically (1.9 then 1.10) while the list view orders them alphabetically (1.10 before 1.2).

Investigation on current main: the TUI board sorts through compareTaskIds (src/ui/board.ts), and the CLI plain and JSON outputs and the web task list all use the same comparator. The TUI list view does not sort at all: task-viewer-with-search.ts takes the loaded corpus as given (filteredTasks = [...allTasks]), so rows appear in load order, which is filesystem order and therefore alphabetical. Verify this before changing anything, since the reporter's screenshot does not name the surface and the fix must land where the divergence actually is.

Fix: route the list view through the existing shared comparator so every surface answers the same way. Do not add a second sorting implementation.

The reporter also asked for a configurable and persisted sort order. That is out of scope: the CLI already exposes --sort, and consistency is the defect being fixed here. Do not build sort configuration or persistence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The TUI list view orders tasks by the shared task ID comparator, so TASK-1.9 precedes TASK-1.10 and subtask ordering matches the board
- [ ] #2 Ordering comes from the existing shared comparator with no new sorting implementation added
- [ ] #3 Board, TUI list, CLI plain and JSON, and the web task list all agree on subtask ordering for the same corpus
- [ ] #4 A regression test covers double-digit subtask ordering (at least 1.2 through 1.11) on the affected surface
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
