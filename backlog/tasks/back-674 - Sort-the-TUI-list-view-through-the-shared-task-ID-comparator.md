---
id: BACK-674
title: Sort the TUI list view through the shared task ID comparator
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-01 17:16'
updated_date: '2026-09-01 17:44'
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
- [x] #1 The TUI list view orders tasks by the shared task ID comparator, so TASK-1.9 precedes TASK-1.10 and subtask ordering matches the board
- [x] #2 Ordering comes from the existing shared comparator with no new sorting implementation added
- [x] #3 Board, TUI list, CLI plain and JSON, and the web task list all agree on subtask ordering for the same corpus
- [x] #4 A regression test covers double-digit subtask ordering (at least 1.2 through 1.11) on the affected surface
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce on a scratch project (custom prefix, parent + 11 subtasks) and compare every surface: CLI plain/JSON, TUI board, TUI list, web list.
2. Confirmed root cause: TaskIdentityIndex.getTasks() (src/core/task-identity-index.ts) orders identity groups with left.id.localeCompare(right.id), an ad-hoc alphabetical ID comparator. ContentStore masks it by re-sorting with sortByTaskId, but Core.loadTasks() returns getTasks() order verbatim, and backlog board feeds that corpus straight into the TUI list, which renders it in array order.
3. Replace the localeCompare with the shared compareTaskIds from src/utils/task-sorting.ts so the one comparator decides, removing the duplicate implementation instead of adding one.
4. Leave every deliberate ordering untouched: board ordinal ordering and parent/subtask grouping, task list --sort and its priority default, web list descending default.
5. Regression tests: assert Core.loadTasks() and TaskIdentityIndex.getTasks() put 1.2 before 1.11 for a 1.1-1.11 subtask corpus, and assert the board corpus, TUI list corpus, CLI list, and web comparator agree on the same corpus.
6. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced #953 on a scratch project (custom ABC prefix, parent + 11 subtasks created with -p) and compared every surface before changing anything.

Findings, which move the defect off the surface the task description named:
- CLI plain and JSON, the web task list, the TUI board, filesystem.listTasks() and Core.queryTasks() were all already correct (ABC-1.9 before ABC-1.10).
- Core.loadTasks() returned ABC-1.1, ABC-1.10, ABC-1.11, ABC-1.2, ... That is the corpus 'backlog board' hands to the unified view, and the TUI list renders its array as given, so pressing Tab from the board showed the alphabetical order the reporter screenshotted. That matches the issue title, 'Sort order in task view of the backlog board'.
- The TUI list view itself is not the defect. Every other entry point into it (task list, draft list, search, task view) already hands it a deliberately sorted array, and task list --sort / its priority default live there, so sorting inside the view would have overridden intentional orderings.
- Root cause: TaskIdentityIndex.getTasks() ordered identity groups with left.id.localeCompare(right.id), a second ad-hoc ID comparator. ContentStore hid it by re-sorting with sortByTaskId; Core.loadTasks() returns getTasks() order verbatim.

Change: getTasks() now sorts groups with the shared compareTaskIds, so the duplicate comparator is removed rather than another sort added. One line plus the import. No deliberate ordering was touched: the board still orders by ordinal with parent/subtask grouping, task list keeps --sort and its priority default, and the web list keeps its descending default.

Tests: new src/test/subtask-ordering-consistency.test.ts builds TASK-1 with subtasks 1.1-1.11 (created in reverse) plus TASK-2 and TASK-11, and asserts the board corpus, every corpus reader, the TUI board columns, the comparator the web list sorts by, and CLI plain and JSON all produce one identical ID order. Added a TaskIdentityIndex unit test for the changed line. Both fail on the pre-fix comparator (verified by reverting it) and pass after. src/ui/board.ts exports prepareBoardColumns so the board assertion reads real board columns instead of re-deriving them.

Out of scope as directed: no configurable or persisted sort order (task list --sort already exists).

Validation: bunx tsc --noEmit clean, bun run check . clean, bun run test green at 2810 pass / 8 skip / 0 fail across 281 files. An earlier run of the same commit reported one failure while three agents' suites ran concurrently on this machine; re-running the full suite on the same tree was green, and the eight files that could be sensitive to corpus ordering (core, board-loading, core-task-corpus-regressions, shared-branch-task-loader, content-store, readme-board, board, no-remote-preflight) pass on their own, so it was a timing flake rather than this change.

Also observed: backlog board export reads the same corpus, so exported markdown boards now list subtasks numerically too. Verified on the reproduction project.

PR: https://github.com/MrLesk/Backlog.md/pull/985

Accepted behavior (maintainer decision, 2026-09-01): a task created while the TUI list view is open still appends to the bottom rather than landing in sort position. The view is deliberately ignorant of ordering — callers hand it an already-sorted corpus, so honoring the active order on insert would mean threading sort state into the view and risks clobbering --sort and the priority default. The placement corrects itself when the view is reopened. Do not 'fix' this without an explicit decision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the alphabetical subtask ordering reported in issue #953. The divergence was not in the TUI list view itself but in TaskIdentityIndex.getTasks(), which ordered identity groups with left.id.localeCompare(right.id); ContentStore masked it by re-sorting, while Core.loadTasks() (the corpus 'backlog board' hands to the unified view) returned that alphabetical order straight into the TUI task list, which renders its array as given. getTasks() now uses the shared compareTaskIds, removing the duplicate comparator instead of adding a sort, and leaving board ordinal ordering, task list --sort and its priority default, and the web list's descending default untouched. Verified by reproducing on a scratch project across every surface, by src/test/subtask-ordering-consistency.test.ts (subtasks 1.1-1.11 plus two-digit top-level ids; board corpus, corpus readers, TUI board columns, the web list comparator, and CLI plain and JSON all assert one identical order) and a TaskIdentityIndex unit test, both confirmed to fail against the old comparator, with tsc, biome, and the full suite green.
<!-- SECTION:FINAL_SUMMARY:END -->
