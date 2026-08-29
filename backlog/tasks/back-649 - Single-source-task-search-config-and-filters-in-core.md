---
id: BACK-649
title: Single-source task search config and filters in core
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-29 21:04'
updated_date: '2026-08-29 22:15'
labels:
  - cli
  - mcp
  - web
dependencies: []
ordinal: 282000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task search is implemented three times with real behavior drift: core SearchService (cross-branch, scores), utils createTaskSearchIndex (local one-shot, duplicated Fuse config verbatim), and a private browser Fuse in MilestonesPage. The bodyText builders differ (task-search includes labels and assignees in searchable text; SearchService does not), so the same query finds a task via task list --search and MCP but not via backlog search or the web API. Label filtering is any/all in one path, any-only in another, all-only in the MCP draft path. Stage 1 of the unification: make utils/task-search.ts the single owner of the searchable-entity builder and the Fuse key/weight/threshold config, consumed by SearchService for its task portion, and fold the three non-query filter implementations (Core.applyTaskFilters, task-search filters, SearchService filters) into one set of shared predicates with the labelMatch divergence resolved explicitly. Labels and assignees become searchable text everywhere (maintainer-approved direction). The local vs cross-branch corpus split stays a deliberate caller decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One module owns the Fuse config and searchable-text builder; SearchService imports it and its duplicated config is deleted
- [x] #2 A query matching a label or assignee finds the task identically via backlog search, task list --search, MCP, and the web API
- [x] #3 One shared filter implementation with explicitly resolved labelMatch semantics; divergent copies deleted
- [x] #4 Tests pin the cross-surface parity, including the labels and assignees cases
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make src/utils/task-search.ts the single owner of the search corpus shape: export buildTaskSearchFields(task) (title, bodyText, id, idVariants, dependencyIds, modifiedFiles) and TASK_SEARCH_FUSE_OPTIONS (threshold/ignoreLocation/minMatchCharLength/keys), so the indexed keys and the text behind them can never drift apart. bodyText keeps labels and assignees (maintainer-approved).
2. Extend the shared filter options in task-search.ts to the union of all three copies (status, excludeStatus, type, priority, assignee, unassigned, labels+labelMatch, modifiedFiles, parentTaskId, milestone, ready) and export createTaskFilterMatcher(options, corpus) + applyTaskFilters over Task, so one predicate set serves every surface.
3. src/core/search-service.ts: import buildTaskSearchFields and TASK_SEARCH_FUSE_OPTIONS; delete its buildTaskBodyText, its inline Fuse config, and BOTH of its filter copies (applyTaskFilters and matchesTaskFilters) in favour of the shared matcher over entity.task.
4. src/core/backlog.ts: delete Core.applyTaskFilters and call the shared applyTaskFilters instead.
5. src/cli.ts: delete taskMatchesAllLabels; the plain/JSON task list passes labels + labelMatch 'all' through baseFilters like every other filter.
6. src/mcp/tools/tasks/handlers.ts: delete the two hand-rolled every() label loops (task path and draft path) and use the shared filters; this also makes MCP label matching case-insensitive like the other surfaces.
7. src/types/index.ts: add labelMatch to TaskListFilter and SearchFilters so the choice is explicit at every boundary.
8. labelMatch resolution: default 'any'; callers that pass an explicitly typed label list (CLI task list --labels in all output modes, MCP task_list labels) pass 'all'. Rationale: the CLI help is the only place the product documents the semantics ('require every comma-separated label') and MCP already required every label, while every remaining consumer is an interactive multi-select picker (TUI board and unified view, web label dropdown) where adding a label must widen the result set. The undocumented HTTP label params keep the 'any' default they have today.
9. Do not touch the local vs cross-branch corpus split, the TUI viewer fallback, or MilestonesPage (BACK-650).
10. Add src/test/task-search-parity.test.ts pinning that a label query and an assignee query return the same task through createTaskSearchIndex and SearchService, and pinning the labelMatch any/all split; then run bunx tsc --noEmit, bun run check ., bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
labelMatch resolution: the shared predicate defaults to 'any', and callers that pass an explicitly typed label list pass 'all'. Only one surface documents the semantics -- the 'backlog task list --labels' help text says 'require every comma-separated label' -- and the MCP task_list labels argument already required every label, so both now pass labelMatch: 'all'. Every remaining consumer is an interactive multi-select picker (TUI board and unified view, web label dropdown) where adding a label must widen the result set, so those keep 'any'. The undocumented HTTP label parameters keep the 'any' default they already had; verified /api/tasks?label=backend&label=infrastructure still returns both tasks.

Two pre-existing bugs fell out of the consolidation. The plain and JSON 'task list --labels' path filtered with a local taskMatchesAllLabels helper applied after the query, while Core.applyTaskFilters matched any label; both now run one predicate. MCP label matching compared raw strings, so a task labelled 'Backend' did not match 'backend'; it is case-insensitive now like every other surface.

MCP drafts: the hand-rolled filter chain became one applyTaskFilters call. Draft assignee matching is now trimmed and case-insensitive (it was an exact Array.includes). The 'search narrows drafts to the literal Draft status, listing them does not' quirk was preserved deliberately rather than silently changed.

Kept out of scope per the task: the local vs cross-branch corpus split, the TUI viewer fallback, and MilestonesPage (BACK-650).

Simplification pass: applySharedTaskFilters and SharedTaskFilterOptions were left as a pure alias after the merge, so both were deleted and the board and unified view now call applyTaskFilters directly.

Rebased onto origin/main after BACK-643 (PR #924) added the project task attribute. That feature had added project filtering to every filter copy this task deletes, so a conflict resolution taking either side wholesale would have silently dropped project filtering. Resolution folds project into the shared predicate: TaskFilterOptions gains 'project', createTaskFilterMatcher calls matchesProjectFilter (OR across the list, a task with no project never matches a non-empty filter), and every former call site keeps threading it -- Core.queryTasks searchFilters pass-through, the MCP task and draft paths including the draft status condition, the board, and the unified view. Core.applyTaskFilters no longer imports matchesProjectFilter since the predicate owns it.

Added a 'filter wiring across surfaces' test block that drives the real CLI and MCP surfaces rather than the predicate alone, because an argument dropped at a call site is invisible to a predicate-level test. Each pin was mutation-verified: removing labelMatch 'all' from the MCP handler fails two tests, removing it from the CLI baseFilters fails one, and removing the project check from the shared predicate fails the project parity test and the OR-semantics test. All mutations were reverted after checking.

Three emoji-width test failures seen mid-rebase were stale node_modules after BACK-646 bumped neo-neo-bblessed; bun i fixed them and bun.lock is unchanged, so no update-nix run is needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/utils/task-search.ts is now the single owner of task search and task filtering. It exports buildTaskSearchFields (title, bodyText, id, idVariants, dependencyIds, modifiedFiles) and TASK_SEARCH_FUSE_OPTIONS, and SearchService imports both instead of keeping its own copies, so the indexed keys and the text behind them cannot drift. Labels and assignees are now in the searchable text on every surface. The four non-query filter implementations (Core.applyTaskFilters, SearchService's applyTaskFilters and matchesTaskFilters, the CLI's taskMatchesAllLabels, and the MCP adapter's two label loops) collapsed into one createTaskFilterMatcher predicate set; labelMatch defaults to 'any' with the CLI --labels flag and the MCP labels argument passing 'all' to match the documented CLI contract.

Verified end to end against a scratch project: 'backlog search infrastructure', 'task list --search infrastructure', and GET /api/search?query=infrastructure all return the same task, as do the same three surfaces for the assignee query 'morgan'; 'task list --labels backend,infrastructure' returns only the task carrying both, 'task list --labels BACKEND' matches case-insensitively, and GET /api/tasks?label=backend&label=infrastructure still returns both tasks so the interactive picker keeps widening. Automated: bunx tsc --noEmit clean, bun run check . clean, bun test 2471 pass / 0 fail, including nine new cross-surface parity tests in src/test/task-search-parity.test.ts. Net -300 lines of production code.
<!-- SECTION:FINAL_SUMMARY:END -->
