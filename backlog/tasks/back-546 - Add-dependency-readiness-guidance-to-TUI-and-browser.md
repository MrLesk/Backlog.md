---
id: BACK-546
title: Add dependency readiness guidance to TUI and browser
status: In Progress
assignee:
  - '@alex-agent'
created_date: '2026-07-13 16:06'
updated_date: '2026-08-07 23:20'
labels:
  - tui
  - web
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/785'
type: enhancement
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Address the reported need to see what can be worked next without silently restoring the abandoned derived-sequence model or changing ordinal ordering by default.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Plan review defines ready and blocked semantics for partial graphs, cycles, missing dependencies, and dependencies in other statuses
- [ ] #2 The TUI and browser present consistent, non-mutating readiness and blocked guidance
- [ ] #3 Existing ordinal order remains authoritative unless Alex explicitly approves an ordering change
- [ ] #4 Cycles and ambiguous dependency data are represented honestly and fail safely
- [ ] #5 Users can identify which dependencies block a task
- [ ] #6 Automated tests and rendered QA cover ready, blocked, cross-status, missing, and cyclic examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Takeover of contributor PR #814 (cottrell, draft). Maintainer decision: the readiness code is needed and should merge; original work by David Cottrell (@cottrell) is ported with authorship preserved on the first commit, adaptations recorded here.

1. Port his branch (base was 63 commits behind main) onto current main and resolve conflicts in src/cli.ts and src/web/components/TaskDetailsModal.tsx.
2. Keep the shared helper getTaskReadiness(task, allTasks, statuses) in src/utils/readiness.ts, resolved per task from dependencies at read time. No ordering or state semantics; the removed sequences model is not restored.
3. Fix dependency identity resolution: match dependency IDs with the project canonicalTaskId identity instead of raw lowercase string equality, so zero padded and prefixed variants resolve like the rest of the product.
4. Represent partial graphs honestly: report resolved-but-unfinished dependencies (blocked by) separately from dependency IDs that cannot be resolved (unknown), and fail closed (not ready) for both.
5. Replace the contributor's full-graph loading strategy. Measured on this repo: core.loadTasks({includeCompleted:true}) costs 6.6s versus 1.7s for the active load and 112ms for filesystem.listCompletedTasks(). His patch called the 6.6s load unconditionally in viewTaskEnhanced and in the unified-view loader, which would add seconds to every TUI launch. Build the readiness graph instead from the corpus each surface already has plus listCompletedTasks(), loaded in parallel with existing startup work.
6. Revert the fullGraphTasks plumbing through unified-view.ts; keep only the ready filter flowing from the CLI flag into the interactive viewer.
7. Drop TaskListFilter.ready: Core.applyTaskFilters ignores it, so it was a silently dead filter field. Readiness filtering stays where the full graph is available.
8. Surfaces: backlog task list --ready (plain, json, interactive), TUI detail pane readiness line, browser task-details modal badge, and MCP task_list ready parity through the existing tool (no new MCP tools).
9. Adapt his tests (readiness, cli-task-list, mcp-tasks, unified-view-filters) and verify with tsc, biome, bun test, a rendered TUI check in tmux against a disposable project, and the web modal in the running server.

Deliberate scope boundary: the browser resolves readiness against the corpus the web app already loads, which excludes backlog/completed. Sending 455 completed tasks to the client was judged not worth the payload for this change; unresolved dependencies render honestly as unknown. Out of scope per the maintainer's split of PR #814: the Web 'Ready only' toggle and the TUI R shortcut.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Takeover of contributor PR #814 (cottrell). Original implementation by David Cottrell (@cottrell) is preserved as the first commit on this branch with his git authorship; the adaptation commits are the maintainer's.

Survived from his branch mostly intact: the shared getTaskReadiness helper and its semantics, the --ready flag on task list (help schema, option, plain/json/interactive paths), the MCP task_list ready argument and JSON schema (no new MCP tools), the readiness line in the TUI detail pane, the readiness badge in the browser task-details modal, and the CLI/MCP/unified-view test cases.

Adapted during the takeover:
- Performance. His branch called core.loadTasks({includeCompleted:true}) unconditionally in viewTaskEnhanced and in the unified-view task loader. Measured on this repo (121 active, 455 completed tasks): that call takes 6.6s versus 1.7s for the normal active load, so every TUI launch and every task view would have paid several extra seconds. Replaced with filesystem.listCompletedTasks() (112ms, issued in parallel with the milestone metadata the viewer already loads) and, for CLI/MCP, a shared loadReadinessGraph() that reuses the warm ContentStore via queryTasks plus the completed tasks.
- Reverted the fullGraphTasks plumbing through unified-view.ts entirely; only the ready filter still flows from the CLI flag into the interactive viewer.
- Removed TaskListFilter.ready. Core.applyTaskFilters never handled it, so it was a filter field that silently did nothing.
- Dependency identity. His lookup used raw lowercase string equality, which misses the zero-padded and prefixed variants the rest of the product treats as the same task. Now keyed on canonicalTaskId.
- Partial graphs. His helper folded unresolvable dependency IDs into blockingDependencies, so the UI claimed a task was blocked by unfinished work when the ID simply could not be resolved. blockingDependencies now means resolved-but-unfinished, missingDependencies means unresolvable, both fail closed, and a shared formatReadinessBlockers renders them distinctly on every surface.
- Copy and placement. Readiness only renders when a task actually has dependencies, instead of adding a line to every task that restates its status; his 'Terminal status (Done)' row is gone for the same reason. In the browser the standalone banner moved into the Dependencies card, next to the dependencies it explains.
- TUI rendering bug found in rendered QA: the hourglass glyph is East Asian Wide, blessed miscounts its width, and the detail pane left stale cells behind when re-rendering a shorter line. Replaced with the single-width bullet the TUI already uses for blocked status.
- Browser/CLI divergence found in rendered QA: the web task corpus excludes backlog/completed, so a dependency that had been completed and filed showed 'Unknown dependency TASK-1' in the browser while the CLI and TUI said 'Ready to start'. The modal now resolves only its unresolved dependency IDs through the existing GET /api/tasks/:id endpoint, which already reads completed tasks, so all four surfaces agree without shipping the completed corpus to the client.

Verification: bunx tsc --noEmit, bun run check ., bun run build, and the readiness/cli-task-list/mcp-tasks/unified-view-filters suites all pass. Rendered QA on a disposable project with met, unmet, and completed-and-filed dependencies: TUI detail pane shows 'Readiness: ● Blocked by TASK-2', 'Readiness: ✓ Ready to start', and nothing at all for a task without dependencies; task list --ready returns the same three ready tasks in plain, json and interactive modes; the browser modal shows the matching amber and green badges in the Dependencies card in both light and dark themes.

Known follow-up, deliberately out of scope per the split of PR #814: the interactive view gives no on-screen indication that --ready is active, the same as the existing --limit flag. That belongs with the deferred Web 'Ready only' toggle and TUI shortcut work.
<!-- SECTION:NOTES:END -->
