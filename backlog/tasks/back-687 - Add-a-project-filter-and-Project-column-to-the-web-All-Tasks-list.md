---
id: BACK-687
title: Add a project filter and Project column to the web All Tasks list
status: Done
assignee:
  - '@riverDartGallery'
created_date: '2026-09-16 19:53'
updated_date: '2026-09-16 20:21'
labels: []
dependencies: []
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported in https://github.com/MrLesk/Backlog.md/issues/1005: when a backlog configures `projects:`, the web Kanban board offers an "All projects" filter and shows each task's project, and `backlog task list --project` filters by it, but the web All Tasks list (/tasks) has neither a project filter nor a Project column. Someone working in a monorepo backlog has to switch to the board to narrow or identify tasks by project, and the list view silently drifts from the board and CLI semantics.

BACK-643.6 deliberately left the list out because task type had no list presence to mirror; project differs because the CLI list already filters by it and it is the natural grouping for a monorepo list. The list should reuse the board's project semantics (configured values, case-insensitive canonical URL values, All projects) rather than invent new ones, and stay inert when no projects are configured.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When projects are configured, All Tasks shows a project filter with "All projects" plus the configured projects, and selecting one narrows the list to tasks in that project
- [x] #2 The project filter is kept in the URL `project` query parameter: mixed-case values are canonicalized, unsupported values are cleared, and Clear filters resets it
- [x] #3 When projects are configured, the table shows a sortable Project column with the task project, or an empty marker when unset
- [x] #4 When no projects are configured, neither the project filter nor the Project column renders, and the table keeps its existing column width budget
- [x] #5 Web tests cover filtering by project, All projects showing every task, the Project column, and the no-projects case
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Thread availableProjects from App.tsx into TaskList, as BoardPage already receives it.
2. TaskList: derive project options with getProjectValues; read the `project` URL param through resolveProjectValue with the same isLoading guard and canonicalize/clear it in the existing priority URL effect (one setSearchParams call); include it in syncUrl, hasActiveFilters and Clear filters.
3. Filter client-side with matchesProjectFilter alongside the existing local milestone filter (the board filters client-side too), so it composes with the API-backed status/priority/label filters without a new request path.
4. Render the project select (All projects + configured values) and a sortable Project column using the existing ProjectBadge, both only when projects are configured; the column widths/min width are derived so the no-projects table keeps its budget.
5. Tests in web-task-list-project.test.tsx; run tsc, biome, full test suite, build, and check /tasks in a browser against a scratch backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filtering is client-side with matchesProjectFilter, applied together with the existing local milestone filter to both the unfiltered list and API-backed status/priority/label results, the same way the board filters projects. The `project` URL value is read through resolveProjectValue and canonicalized or cleared in the existing priority URL effect, merged into one setSearchParams call so the two canonicalizations cannot overwrite each other. The Project column reuses ProjectBadge and sits before Milestone; like Milestone it is a single text value, so it is sortable.

Width trade-off: with no projects configured the columns and min width are unchanged (web-task-list-table-width.test.tsx still passes). With projects configured the table gains a 6rem column (min width 71.5rem). In Chromium against a scratch backlog with three projects: no horizontal scroll at 1512x900 with the sidebar expanded, but at 1440x900 with the sidebar expanded the table scrolls 58px inside its own container (no page overflow). The filter row wraps Labels onto a second line at 1512 both with and without the new select, since the five existing controls already exceed the row width there.

Validation: bunx tsc --noEmit clean; bun run check . clean (428 files); bun run test 2879 pass / 8 skip / 1 fail. The one failure (board-tui-move.test.ts "persists cross-column recruits in exactly the order rendered by the collapse preview") fails identically on unmodified main under the full suite (2871 pass / 8 skip / 1 fail) and passes in isolation on both. New web-task-list-project.test.tsx: 8 tests, 7 of which fail against the unmodified TaskList. bun run build succeeded; /tasks checked in Chromium with the built binary: selecting API narrowed to the two API tasks and set ?project=API, ?project=api&status=To%20Do canonicalized to project=API and showed only the To Do API task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a project filter and a sortable Project column to the web All Tasks list (issue #1005), reusing the board semantics: getProjectValues for the options, resolveProjectValue for canonical `project` URL values (unsupported values cleared, Clear filters resets it), matchesProjectFilter for client-side matching, and ProjectBadge for the cell. Both render only when projects are configured, so unconfigured backlogs keep the existing table and width budget. Verified with 8 new web tests, the full suite (only the pre-existing board-tui-move failure, identical on main), tsc, Biome, a build, and a Chromium check of the built browser UI against a scratch backlog with three projects.
<!-- SECTION:FINAL_SUMMARY:END -->
