---
id: BACK-637.5
title: 'TUI: Display and filter task project in board and detail views'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 16:21'
updated_date: '2026-08-20 17:37'
labels: []
dependencies:
  - BACK-637.1
parent_task_id: BACK-637
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a project display helper (src/ui/project.ts, mirroring src/ui/task-type.ts). Add 'project' to the FilterControlId union and filter-header state/layout/popup wiring in src/ui/components/filter-header.ts. Show project on board cards (src/ui/board.ts) and in the list/detail view (src/ui/task-viewer-with-search.ts), add project to visibleFilters and the filter picker, add a keyboard shortcut and help-popup entry, and add project to src/ui/unified-view.ts/simple-unified-view.ts filter state. Add a project field to the task composer (src/ui/components/task-composer.ts). The project filter control and any project UI must be hidden entirely when no projects are configured, matching the MCP schema's omit-when-empty behavior from BACK-637.3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task board cards and list rows show the project value when set
- [x] #2 A project filter control exists in the TUI filter header and board, filtering the visible tasks
- [x] #3 The task composer includes a project field, populated from configured projects
- [x] #4 The project filter control and badge are completely absent when no projects are configured
- [x] #5 Existing TUI tests (board-ui, tui task type equivalents) pass; new coverage added for project display/filtering
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
New src/ui/project.ts mirrors task-type.ts's formatTaskTypeBadge (formatProjectBadge, blue-fg). Wired badges into board.ts card lines and task-viewer-with-search.ts list rows and detail metadata (Project: line after Type:).

Filter header (filter-header.ts): added 'project' to FilterControlId, FilterState.projects: string[] (array, matching type's multi-value model, not priority's scalar), plus the full button/focus/popup plumbing mirroring 'type' exactly. Both call sites (board.ts, task-viewer-with-search.ts) now pass an explicit visibleFilters array with 'project' spliced in only when configuredProjects.length > 0 -- board.ts's list previously had no explicit array in one construction site, which would have silently always shown project; caught and fixed during implementation, not assumed.

unified-view.ts: threaded projectFilter end-to-end through UnifiedViewFilters/KanbanSharedFilters/createUnifiedViewFilters/mergeUnifiedViewFilters/filterTasksForKanban, and both onFilterChange callback sites (kanban and list/detail).

Keyboard shortcuts: chose G (unbound in both board and list-view key maps) for project, conditionally registered only when configuredProjects.length>0. Extended help-popup.ts's getHelpShortcuts/openHelpPopup with a hasProjects option that filters the G row out entirely when unconfigured -- these are static shortcut lists with no config awareness by default, so this required a small signature change, not just a data addition.

task-composer.ts: the hardest piece. Rather than fit a 4th selector into the existing 3-column percentage-based compact/expanded grid math (which is calibrated exactly for 3), project always renders as its own full-width row below type/priority regardless of layout mode -- this sidesteps recalculating NORMAL_SELECTOR_WIDTH_RATIO/COMPACT_SELECTOR_WIDTH_RATIO entirely. detailsHeight/actionsTop grow by exactly 1 row when projects are configured (getTaskComposerLayout takes projects now). Field is entirely absent (widget hidden, excluded from FIELD_ORDER/selectorFields/navFields/clickFields) when unconfigured. navigate()'s spatial keyboard grid got a project-aware override block appended at the end (type/priority-down -> project, project up/down -> priority/create, create/cancel-up -> project) rather than threading project into every existing compact/stacked/expanded branch -- simpler and lower-risk, verified against the full existing interaction test suite (arrow-key traversal, click handling, Tab order) which still passes untouched since none of it exercises the projects-configured path.

Verification: bunx tsc --noEmit clean, bun run check . clean on all 11 touched files. New tests: tui-task-project.test.ts (3), plus project-specific cases added to board-ui.test.ts, unified-view-filters.test.ts, and tui-task-composer.test.ts (layout height + choices + payload). Full regression run: 167/167 passing across 15 TUI test files, including the large tui-task-composer.test.ts git-integration suite (71 tests) which exercises only the unconfigured default path and confirms zero behavior change there.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the project attribute to the TUI: badges on board cards and list rows (formatProjectBadge in new src/ui/project.ts), a 'Project:' line in task detail view, a filter-header control mirroring --type's multi-value model end-to-end through unified-view.ts's shared filter state, a G keyboard shortcut and help-popup entry, and a task-composer field. The task composer was the hardest piece: rather than recalculate the existing 3-column compact/expanded layout math, project always renders as its own full-width row below type/priority, adding exactly one row to detailsHeight when configured. Every project UI element -- badge aside, which is naturally absent when the field is unset -- is conditionally excluded (filter button, keyboard shortcut, help-popup row, composer field/row) when no projects are configured, verified by dedicated tests. Verified with bunx tsc --noEmit, bun run check . (clean across 11 files), and 167/167 passing tests across 15 TUI test files (new + regression), including the full 71-test task-composer interaction suite confirming the unconfigured default path is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
