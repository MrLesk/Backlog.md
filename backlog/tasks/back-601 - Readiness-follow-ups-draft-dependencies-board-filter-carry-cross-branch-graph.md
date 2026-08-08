---
id: BACK-601
title: >-
  Readiness follow-ups: draft dependencies, board filter carry, cross-branch
  graph
status: To Do
assignee: []
created_date: '2026-08-08 05:36'
updated_date: '2026-08-08 08:05'
labels:
  - tui
  - web
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/873'
priority: low
type: enhancement
ordinal: 240000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three dependency-readiness gaps deferred from the review of PR #873 (BACK-546), which added readiness guidance to the CLI, TUI, browser, and MCP. Each makes readiness under-report rather than over-report, so none is a correctness hazard on its own, but each produces guidance a user can see is wrong.

1. Draft-on-draft dependencies always report as unknown in the browser. The task-details modal resolves a dependency that is not in the board corpus by fetching it by ID, and that endpoint never returns drafts. A draft that depends on another draft therefore shows "Unknown dependency" permanently. Decide whether drafts belong in the readiness graph at all, and if so give the browser a way to resolve them.

2. Tab from a ready-filtered task list to the board silently drops the filter. The readiness filter arrives from the CLI --ready flag and is not represented in the board view, so switching views widens the list with no explanation. This belongs with the deferred half of PR #814: the browser "Ready only" toggle and the TUI shortcut for toggling readiness. Deciding how readiness is represented as a filter control should settle this at the same time.

3. With checkActiveBranches enabled, cross-branch terminal dependencies are excluded from the readiness graph. The graph is built from the local corpus plus completed tasks, so a dependency that exists only on another branch cannot be resolved and fails closed as unknown, even though dependency validation accepts it when the task is created. The behavior is config-gated and fails toward blocked, so it is safe but inconsistent with what validation allows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Draft dependencies either resolve in the browser readiness graph or are documented as out of scope with the browser reporting them honestly
- [ ] #2 Switching between the task list and the board either carries the readiness filter or makes its absence visible
- [ ] #3 A cross-branch dependency that dependency validation accepts resolves in the readiness graph, or the limitation is surfaced to the user rather than shown as an unknown dependency
- [ ] #4 Automated tests cover each resolved case, including the checkActiveBranches configuration
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fourth deferred item, from review round 3 of PR #873: getTaskStatistics in src/core/statistics.ts counts blocked tasks with semantics that diverge from the shared readiness helper. It matches dependencies with exact string equality (tasks.find((t) => t.id === depId)), so zero-padded or differently-prefixed IDs that canonicalTaskId treats as the same task are missed; it hard-codes the literal "Done" instead of resolving the configured terminal status, so a project that renamed its terminal status gets wrong blocked counts; and it treats an unresolvable dependency as not blocking (dep && dep.status !== "Done"), which is the opposite of the fail-closed rule readiness now applies everywhere else. This is pre-existing statistics behavior rather than a regression, but it means the statistics view and the readiness guidance can disagree about the same task. Align it with getTaskReadiness or document why the counts differ.
<!-- SECTION:NOTES:END -->
