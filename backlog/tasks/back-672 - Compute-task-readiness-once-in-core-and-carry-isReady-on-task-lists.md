---
id: BACK-672
title: Compute task readiness once in core and carry isReady on task lists
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-01 17:04'
updated_date: '2026-09-01 17:49'
labels: []
dependencies: []
ordinal: 304000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Readiness is a domain concept that four interfaces currently recompute for themselves: the TUI builds its own graph (buildReadinessGraph in task-viewer-with-search.ts), the browser builds one from the board corpus inside TaskDetailsModal.tsx, and the CLI and MCP each call loadReadinessGraph. That is the same duplication BACK-548 removed for dependency graphs, and it has already produced divergence: the browser answers from the board corpus, so its verdict can differ from the CLI's for the same task, which is where the BACK-601 gaps came from.

Fold readiness into core the way the dependency graph was folded in. It derives from the same corpus loadTaskCorpus already builds (createReadinessGraph and buildDependencyGraph take the same options shape), so one corpus load answers both questions and they can never disagree.

Two carriers, because the two shapes have different costs and audiences. Task lists, search results, and board projections carry a plain isReady boolean per task, computed in one pass over the corpus rather than per task, so a list interface never issues N+1 lookups to decide what to grey out or badge. Task details carry the fuller readiness beside dependencyGraph, including the blockers the browser modal already renders through formatReadinessBlockers.

Interfaces then only display. No surface may build a readiness graph of its own after this. Readiness stays derived at read time and is never written into the Markdown record.

Watch the cost of readiness on list paths: it needs the completed corpus to know whether a dependency is finished, and list loads do not all pay for that today. Measure before making every list load the completed corpus, and keep allocation and other non-display paths off the readiness work entirely.

This likely dissolves most of BACK-601, whose three gaps are all consequences of per-surface computation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Readiness is computed in core from the same corpus as the dependency graph, once per read, and no interface calls createReadinessGraph or loadReadinessGraph directly
- [ ] #2 Task list, search, and board projections carry an isReady boolean per task computed in a single corpus pass, with no per-task lookup in any interface
- [x] #3 Task detail carries readiness alongside dependencyGraph, including blockers, and the browser modal renders that instead of computing its own
- [x] #4 task list --json exposes isReady per task and task view --json exposes the detail readiness, both additive to the existing contracts
- [x] #5 CLI --ready, MCP ready, and the TUI ready filter all resolve through the shared computation and agree with each other and with the browser for the same task
- [x] #6 List read paths do not regress measurably; the completed corpus is loaded only where readiness is actually rendered, and allocation paths do no readiness work
- [x] #7 Automated tests cover agreement across surfaces, isReady on list payloads, blocked and unblocked chains, completed dependencies, and unresolved or ambiguous dependencies failing closed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core fold (src/core/task-detail.ts): TaskDetail gains readiness beside dependencyGraph; add TaskListItem = Task & { isReady }; toTaskDetail(task, corpus) replaces withDependencyGraph and derives both from one corpus; withReadiness(tasks, corpus) builds the readiness graph once and maps the list in a single pass; loadTaskListItems(core, tasks) mirrors loadTaskDetail; add the taskReadiness(task) accessor next to taskDependencyGraph. Delete loadReadinessGraph from utils/readiness.ts (it becomes a pure util again) and delete the ready?: ReadinessGraph option from utils/task-search.ts so no surface can pass a graph of its own.
2. CLI: task list attaches readiness only where it is rendered or filtered (--ready or --json); --ready filters the projection instead of building a graph. search --json attaches readiness in one corpus pass. Plain/text list, edit, create and allocation paths keep loading no completed corpus.
3. JSON contract (additive, schemaVersion 1): isReady on the shared task summary used by task list --json and search --json task results; readiness (isReady, isBlocked, blockingDependencies, missingDependencies) on task view --json beside dependencyGraph. Update CLI-INSTRUCTIONS.md field lists.
4. MCP: both ready branches (drafts and tasks) filter the shared projection instead of calling loadReadinessGraph.
5. TUI: the viewer already holds a live TaskCorpus; build the detail with toTaskDetail and filter the ready list with withReadiness over that corpus. generateDetailContent renders the readiness carried by the task it was handed and drops its readinessGraph option, so a caller without a detail still gets no readiness claim.
6. Web: the task-details modal renders the readiness the detail read delivers and drops its own createReadinessGraph plus the per-dependency off-board fetches. App.tsx preserves readiness with dependencyGraph when the list refresh replaces the record, and re-reads the detail when dependencies or status change.
7. Performance: measure the completed-corpus cost before adding it to any list path and record the numbers; keep readiness off the web board/search endpoint until the follow-up ready filter renders it.
8. Tests: cross-surface agreement (CLI/MCP/TUI/web on one project), isReady on task list --json and search --json payloads, blocked and unblocked chains, dependencies completed into backlog/completed, and unresolved or ambiguous dependencies failing closed; rewrite the existing readiness and task-search tests onto the shared projection.
9. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core fold: TaskDetail now carries readiness beside dependencyGraph, and a new TaskListItem (Task & { isReady }) is what lists, search results and board projections return. toTaskDetail (renamed from withDependencyGraph) derives both from one corpus in one call; withReadiness builds the readiness index once and maps a whole list in a single pass; loadTaskListItems mirrors loadTaskDetail for surfaces that read per list. Added the taskReadiness accessor next to taskDependencyGraph.

Deleted: loadReadinessGraph (utils/readiness.ts is a pure util again, no Core import), the ready?: ReadinessGraph filter option and its predicate in utils/task-search.ts, the TUI's buildReadinessGraph plus the readinessGraph option on generateDetailContent, and the browser modal's createReadinessGraph call together with the per-dependency off-board fetch effect it existed for (that fetch was the N+1 BACK-601 round 4 flagged; the alias-duplication bug it caused is gone with it). Net: 20 files changed, more deleted than added in the surfaces.

Surfaces now only render: CLI --ready filters the projection; MCP ready (tasks and drafts) filters the same projection; the TUI derives readiness over the filtered list against its live corpus (which already merges in-session completions) and the detail pane renders task.readiness; the browser modal renders the readiness the detail read delivers.

JSON contract (additive, schemaVersion 1): isReady on the shared task summary used by task list --json and search --json task results, and readiness (isReady, isBlocked, blockingDependencies, missingDependencies) on task view --json. CLI-INSTRUCTIONS.md field lists updated. Never serialized: serializeTask whitelists frontmatter keys, so neither field can reach Markdown.

Performance, measured A/B against origin/main on this repo (199 active + 455 completed records, same backlog dir via BACKLOG_CWD, 3 runs each): task list --plain 273-279ms base vs 279-325ms branch (unchanged code path, no completed corpus loaded); task list --json 267-286ms vs 282-307ms (about +15ms for the one completed-corpus read); task list --plain --ready 103-111ms vs 102-108ms (unchanged); search --json 3.59s vs 3.64s. The readiness pass itself is ~1ms for 199 rows over a 654-record corpus. Allocation, edit, create and plain/interactive list paths load no completed corpus at all.

Scoped deliberately: the browser's list/board corpus (GET /api/search, which is what App.tsx loads the board and task list from) does not carry isReady. Nothing in the browser renders it today (the modal badge comes from the detail read), that endpoint also serves the per-keystroke search box, and a corpus load there measured ~17ms per request on this repo. The follow-up web ready filter should add it where the UI renders it.

Verification: bunx tsc --noEmit clean; bun run check . clean; bun run test 2809 pass / 8 skip / 0 fail across 281 files (2805 before, +4 new). RUN_INTERACTIVE_TUI_TESTS=1 bun test src/test/tui-ready-filter-pty.test.ts passes, so the interactive --ready render is still correct end to end. New src/test/readiness-surface-agreement.test.ts runs one project through the CLI list JSON, --ready, task view JSON, MCP task_list ready, the browser detail endpoint and the interactive corpus and asserts one shared verdict, plus a contested-identity case that fails closed on every read that still answers.

Rendered browser QA on a disposable project (completed dependency, unfinished chain, unknown dependency): TASK-3 shows 'Ready to start' with its dependency living in backlog/completed (the case the deleted off-board fetch used to handle), TASK-4 shows 'Blocked by TASK-2', TASK-5 shows 'Unknown dependency TASK-404', no console errors. Liveness re-checked: changing the open task's status to Done inline removes the badge and changing it back restores 'Blocked by TASK-2'; adding a dependency out of band while the modal is open refreshes the badge to 'Blocked by TASK-3'. A dependency completed elsewhere while a modal stays open refreshes when the detail is read again, the same staleness the dependency graph already has.

AC #2 left unchecked: the CLI task list and search JSON projections, the MCP list and the interactive list all carry or filter on the single-pass isReady, but the browser's board and task-list corpus (GET /api/search) does not, for the reason recorded above. Everything else in that criterion holds; the remaining half is a one-line addition to that endpoint whenever the web ready filter renders it, and it needs a product call on paying the per-request cost before anything displays it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Readiness became a derived field computed once in core, exactly like the dependency graph in BACK-548: toTaskDetail answers readiness and the graph from one corpus in one call, withReadiness maps a whole list from a single index, and every surface only renders the result. Removed the four separate computations (TUI buildReadinessGraph, browser modal createReadinessGraph plus its per-dependency fetches, CLI and MCP loadReadinessGraph) and the ready graph option in task-search, so no interface can reach a verdict of its own. task list --json and search --json now publish isReady and task view --json publishes readiness with its blockers, additive under schemaVersion 1 and documented in CLI-INSTRUCTIONS.md. Verified with bunx tsc --noEmit, bun run check ., bun run test (2809 pass, 0 fail), the interactive --ready PTY test, a new cross-surface agreement suite covering completed, blocked, unknown and contested dependencies, and rendered browser QA of the three badge states with inline and out-of-band edits. Readiness stays read-time only: serializeTask whitelists frontmatter, so neither field can reach Markdown. Measured A/B on a 654-record project: plain and interactive list reads and allocation paths load no completed corpus and are unchanged; only task list --json pays for it, about +15ms.
<!-- SECTION:FINAL_SUMMARY:END -->
