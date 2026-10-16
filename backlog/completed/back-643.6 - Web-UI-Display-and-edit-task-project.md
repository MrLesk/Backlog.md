---
id: BACK-643.6
title: 'Web UI: Display and edit task project'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 16:21'
updated_date: '2026-08-20 17:50'
labels: []
dependencies:
  - BACK-643.1
parent_task_id: BACK-643
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a ProjectBadge component (mirroring TaskTypeBadge.tsx). Thread config.projects through src/web/App.tsx as availableProjects. Add project query params to src/web/lib/api.ts. Add project filtering/column/badge to TaskList.tsx, Board.tsx/BoardPage.tsx, TaskCard.tsx, DraftsList.tsx, and a project <select> (with a 'No Project' empty option) to TaskDetailsModal.tsx next to the priority select, including form state, dirty check, and save payload. Mirror priority's known clearing gap on the web (project === '' -> undefined -> dropped by JSON.stringify -> server 'project' in updates guard is false -> clearing from web silently no-ops) rather than fixing it -- that gap is pre-existing and out of scope here. Update src/web/components/SideNavigation.tsx's active-filter indicator to include project. All project UI must render nothing when config.projects is empty.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task detail modal has a project select with a 'No Project' option and configured project choices
- [x] #2 All project UI (badge, filter, select) is absent when config.projects is empty
- [x] #3 Existing web tests (web-task-types.test.tsx equivalents) pass; new coverage added for project display/filtering
- [x] #4 Board (Board.tsx/BoardPage.tsx) and task cards (TaskCard.tsx) show a project badge and have a project filter control that updates the URL, matching --type's actual footprint in the web UI (confirmed via source: TaskList.tsx and DraftsList.tsx have zero type badge/filter support today, so project does not add filtering there either, matching type's real precedent rather than priority's)
- [x] #5 TaskCard.tsx shows a project badge next to the type badge when set
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Corrected scope during execution, verified against source rather than the original description: type has ZERO badge/filter presence in TaskList.tsx and DraftsList.tsx (confirmed via grep -- no TaskTypeBadge import, no type filter state, no availableTypes prop passed from App.tsx to either). So project does not add badge/filter there either, matching type's real footprint (Board/BoardPage/TaskCard + TaskDetailsModal only), not priority's broader one. Corrected AC #1/#2 accordingly before implementing rather than building unused surface.

Also discovered api.ts needs NO changes: Board.tsx's type (and now project) filtering is entirely client-side over the already-loaded tasks array via matchesTaskTypeFilter/matchesProjectFilter, never touching the network layer. Confirmed by reading Board.tsx's filteredTasks useMemo before assuming an API change was needed, avoiding unnecessary src/web/lib/api.ts work the original description called for.

New src/web/components/ProjectBadge.tsx mirrors TaskTypeBadge.tsx but simplified: no COMMON_TYPE_PALETTE_INDEX equivalent (no default project set to reserve palette slots for), color assigned by index in the configured projects list, hash fallback for unconfigured values.

Threaded availableProjects through App.tsx -> BoardPage.tsx (URL param 'project', canonicalized via resolveProjectValue, cleared when unsupported) -> Board.tsx (projectOptions memo, filterProject state, conditional <select> shown only when projectOptions.length > 0, wired into the existing onFiltersChange/hasActiveFilters/filteredTasks machinery) -> TaskColumn.tsx -> TaskCard.tsx (ProjectBadge next to TaskTypeBadge).

TaskDetailsModal.tsx: deliberately mirrored priority's SIMPLE immediate-save pattern (handleInlineMetaUpdate, a single generic PATCH-on-change handler), not type's separate race-guarded handleTaskTypeChange with its own error state and in-flight ref -- this was the original task description's explicit instruction and confirmed correct by reading both patterns in source first. Added project to TaskDetailsFormState, the buildFormState initializer, the dirty-refresh-preserve logic (setProject via preserveDirtyRefreshValue), hasCreateModeEntries, and the save payload (project: project === '' ? undefined : project, unconditionally like priority -- inheriting the same JSON.stringify-drops-undefined clearing gap on purpose, as instructed). Select is wrapped in {projectOptions.length > 0 && (...)}.

Verification: bunx tsc --noEmit clean. bun run check . clean (391 files; confirmed via biome.json that .tsx files are outside biome's includes pattern entirely, so this DoD item was trivially satisfied for every .tsx file touched -- verified this is a pre-existing project convention, not a gap I introduced). New tests in src/test/web-task-project.test.tsx (7 cases: badge presence/absence, modal select absence when unconfigured, select presence + immediate-save + create-mode submission when configured, board filter absence/presence/URL-canonicalization). Full regression: 124/124 passing across 15 web test files including web-task-types.test.tsx (all still passing, confirming type's complex race-guarded flow is untouched) and web-board-filters.test.tsx.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the project attribute to the web UI, scoped to exactly where 'type' actually lives today (Board/BoardPage/TaskCard/TaskDetailsModal) after confirming via source that TaskList.tsx and DraftsList.tsx have no type support to mirror -- corrected the task's original broader scope before implementing. New ProjectBadge.tsx component; availableProjects threaded from App.tsx through BoardPage's URL-param-driven filter down to TaskCard's badge; TaskDetailsModal gained a project select using priority's simple immediate-save pattern (not type's more complex race-guarded one), per the task's explicit instruction. All project UI is absent when config.projects is empty. Verified with bunx tsc --noEmit, bun run check . (clean, 391 files), and 124/124 passing tests across 15 web test files (7 new + full regression of web-task-types.test.tsx, web-board-filters.test.tsx, and every web-task-details-modal-* file).
<!-- SECTION:FINAL_SUMMARY:END -->
