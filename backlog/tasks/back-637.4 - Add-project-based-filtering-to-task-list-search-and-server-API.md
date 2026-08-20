---
id: BACK-637.4
title: 'Add project-based filtering to task list, search, and server API'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 16:20'
updated_date: '2026-08-20 16:57'
labels: []
dependencies:
  - BACK-637.1
parent_task_id: BACK-637
ordinal: 277000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add --project filtering to task list, search, and draft list in src/cli.ts, matching --type's multi-value OR semantics (not --labels', whose AND/OR behavior differs inconsistently across CLI/MCP/HTTP -- do not replicate that inconsistency). Add normalizeCliProject to src/cli.ts (used only here, not on create/edit). Wire project filtering into Core.filterTasks and the searchFilters bridge in src/core/backlog.ts, ContentStore.getTasks in src/core/content-store.ts, the search-service projectLower projection and both filter engines in src/core/search-service.ts, src/utils/task-search.ts's applyTaskFilters, and FileSystem.listTasks in src/file-system/operations.ts. Add project query-param handling to GET /api/tasks and GET /api/search in src/server/index.ts, returning 400 with formatValidProjectValues on an invalid value like priority does. Update CLI-INSTRUCTIONS.md's canonical field list and the guideline docs under src/guidelines/ (cli-instructions/task-creation.md, cli-instructions/overview.md, mcp/overview.md, mcp/overview-tools.md, agent-guidelines.md) to document --project.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task list --project <value> and --project a,b (OR) work, matching --type's semantics
- [x] #2 backlog search --project <value> filters results
- [x] #3 Core.filterTasks, ContentStore.getTasks, FileSystem.listTasks, and both task-search/search-service filter engines all honor the project filter consistently
- [x] #4 CLI-INSTRUCTIONS.md and src/guidelines/* document the project field and --project flag
- [x] #5 Tests cover filtering across CLI, server, and MCP-adjacent core paths
- [x] #6 GET /api/search?project=... filters task results with OR semantics and returns 400 with valid values listed on an invalid or unconfigured project, mirroring priority's HTTP validation pattern. GET /api/tasks intentionally gains no project param: it is the unfiltered base fetch for the web task list and has no type filter either (confirmed: task type has zero HTTP-layer filtering today -- the /api/search 'type' param is the result kind, not task type). BACK-637.6 will decide whether the web UI's project filter goes through /api/search (like priority/labels already do) or filters client-side.
- [x] #7 task_list and task_search MCP tools support filtering by project with OR semantics and canonical-casing validation, matching type's precedent. Implemented in src/mcp/tools/tasks/handlers.ts (TaskListArgs/TaskSearchArgs, both draft and task branches) and src/mcp/utils/schema-generators.ts (generateProjectFilterSchema, wired into generateTaskListSchema and generateTaskSearchSchema, omitted when unconfigured). src/mcp/tools/tasks/schemas.ts needed no direct changes -- it only re-exports the generator output built with an empty config object for a static workflow-documentation test, which already omits unconfigured fields correctly.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Corrected scope twice during execution, both against verified evidence:
1. task_list MCP filtering: moved from BACK-637.3 to this task (matching the actual BACK-355 commit split -- .03 was mutation-only, .04 added filtering).
2. Server API: verified via 'grep getAll("taskType")' that task type has ZERO HTTP-layer filtering (the /api/search 'type' param is result-kind task|document|decision, not task type). So project follows type's real precedent -- no changes to GET /api/tasks. However, I DID add project filtering to GET /api/search, since that endpoint already has real SearchService-backed filtering infra (priority/labels/status all work there) and it costs little now versus deferring to BACK-637.6.

Core/filesystem/search-service/task-search: added filters.project handling in Core.applyTaskFilters, the searchFilters bridge, ContentStore.getTasks, FileSystem.listTasks, SearchService's NormalizedFilters+both filter engines (using task.task.project directly via matchesProjectFilter, no separate projectLower projection needed -- mirrors how type is actually implemented there, not priority/labels' pre-lowered-field pattern).

CLI: added --project to task list and search (both share the flag name, unlike --type/--task-type's split), added normalizeCliProjects (multi-value, with its own 'no projects configured' guard distinct from per-value validation), added the active-filter banner line, and caught + fixed a real gap: task list --help was missing 'project' from its documented optional-fields schema even after the --option() was added (found via a failing test, not by inspection).

MCP: task_list and task_search both gained project (list/search filter schema conditionally include project, omitted when unconfigured). Found and fixed a real bug via a failing test: task_search's 'query, modifiedFiles, or type filter required' guard didn't account for project-only searches -- fixed the guard and its error message.

Completions: had to widen slice 2's task-only scoping for --project once list/search filtering landed (added list+search to the switch case), and updated the now-stale cli-task-project.test.ts assertion that previously expected task list --project to have no completions.

Docs: updated CLI-INSTRUCTIONS.md's canonical JSON field list (project), src/guidelines/cli-instructions/task-creation.md's flag enumeration, and src/guidelines/mcp/overview.md + overview-tools.md's task_list/task_search descriptions -- all three already documented --type, matching precedent. Left cli-instructions/overview.md, task-execution.md, and agent-guidelines.md untouched since none of them document --type/--task-type either, so adding --project there would be new documentation depth beyond what type itself received.

Verification: bunx tsc --noEmit clean, bun run check . clean on all 29 touched files. New tests: task-project-filtering.test.ts (8), mcp-task-project-filtering.test.ts (5), server-search-project-filter.test.ts (4) = 17 new tests, all passing. Full regression sweep of 126 tests across 10 files (project + type + wizard + mcp-tasks + server-search-endpoint) -- 0 failures. Separately verified config-commands.test.ts's 1 failure is the same pre-existing tab-indentation YAML issue confirmed unrelated in slice 1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added project-based filtering across every layer that filters by task type today: Core.applyTaskFilters, ContentStore.getTasks, FileSystem.listTasks, SearchService (both filter engines), and task-search.ts's applyTaskFilters, all using the new matchesProjectFilter helper with --type's OR semantics (not --labels' inconsistent AND/OR). Surfaced through backlog task list --project, backlog search --project, and MCP task_list/task_search (project omitted from schemas when unconfigured). GET /api/search gained project support; GET /api/tasks deliberately did not, since verified evidence showed task type has no HTTP filtering at all today. Documented in CLI-INSTRUCTIONS.md and the three guideline files that already document task type. Corrected two scope assumptions during execution against verified evidence (MCP list-filtering slice placement, and the /api/tasks vs /api/search split) rather than following the original task description as written. Verified with bunx tsc --noEmit, bun run check . (clean across 29 files), and 17 new tests (task-project-filtering, mcp-task-project-filtering, server-search-project-filter) plus a 126-test regression sweep, all passing.
<!-- SECTION:FINAL_SUMMARY:END -->
