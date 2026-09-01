---
id: BACK-672
title: Compute task readiness once in core and carry isReady on task lists
status: To Do
assignee: []
created_date: '2026-09-01 17:04'
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
- [ ] #1 Readiness is computed in core from the same corpus as the dependency graph, once per read, and no interface calls createReadinessGraph or loadReadinessGraph directly
- [ ] #2 Task list, search, and board projections carry an isReady boolean per task computed in a single corpus pass, with no per-task lookup in any interface
- [ ] #3 Task detail carries readiness alongside dependencyGraph, including blockers, and the browser modal renders that instead of computing its own
- [ ] #4 task list --json exposes isReady per task and task view --json exposes the detail readiness, both additive to the existing contracts
- [ ] #5 CLI --ready, MCP ready, and the TUI ready filter all resolve through the shared computation and agree with each other and with the browser for the same task
- [ ] #6 List read paths do not regress measurably; the completed corpus is loaded only where readiness is actually rendered, and allocation paths do no readiness work
- [ ] #7 Automated tests cover agreement across surfaces, isReady on list payloads, blocked and unblocked chains, completed dependencies, and unresolved or ambiguous dependencies failing closed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
