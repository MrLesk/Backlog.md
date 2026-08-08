---
id: BACK-546
title: Add dependency readiness guidance to TUI and browser
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-07-13 16:06'
updated_date: '2026-08-08 05:42'
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
- [x] #1 Plan review defines ready and blocked semantics for partial graphs, cycles, missing dependencies, and dependencies in other statuses
- [x] #2 The TUI and browser present consistent, non-mutating readiness and blocked guidance
- [x] #3 Existing ordinal order remains authoritative unless Alex explicitly approves an ordering change
- [x] #4 Cycles and ambiguous dependency data are represented honestly and fail safely
- [x] #5 Users can identify which dependencies block a task
- [x] #6 Automated tests and rendered QA cover ready, blocked, cross-status, missing, and cyclic examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

Final verification on the built binary (dist/backlog) against a disposable project with a met dependency, an unmet dependency, and a dependency completed into backlog/completed:
- Full suite: bun run test -> 1985 pass, 0 fail, 1990 tests across 217 files, exit 0. bunx tsc --noEmit, bun run check ., and bun run build all clean.
- The full suite caught two regressions that the scoped tests missed, both now fixed and re-verified: an infinite React render loop in the task-details modal (the readiness effect depended on arrays recreated every render and reset state with a fresh empty array), and the shipped MCP workflow overview, which mcp-server.test.ts requires to document every task_list schema filter.
- Also fixed during review: the board quick-look popup calls generateDetailContent without a task graph and would have reported every dependency as unknown. Readiness inputs are now an explicit optional context, so that popup makes no readiness claim at all. Verified by rendered board QA.
- CLI: task list --ready returns TASK-2, TASK-4, TASK-6 and excludes blocked TASK-3, in plain, json and interactive modes, including with --status 'To Do'. TASK-4 depends on a task living in backlog/completed and is still correctly reported ready.
- MCP: driven over stdio against the shipped binary, task_list with ready true returns the same three tasks and without it returns all four. No new MCP tools; the existing tool and schema carry the filter.
- TUI: detail pane shows 'Readiness: ● Blocked by TASK-2' and 'Readiness: ✓ Ready to start', nothing for a task without dependencies, and no stale render cells when navigating between them.
- Browser: the Dependencies card shows the matching amber and green badges in light and dark themes with no console errors.

Merged origin/main (BACK-593 web task-ID linking) into the branch. The merge was clean, but the full suite then failed one rendered assertion: main made the task-details modal router-dependent, so the readiness modal test now wraps it in MemoryRouter and TaskIdIndexProvider like the other modal tests. Re-verified on the merged tree: bun run test 2008 pass, 0 fail across 219 files; tsc, biome and build clean; TUI detail pane, browser modal (ready and blocked, no console errors), and task list --ready all re-checked on the rebuilt binary.

Review round 2 (Codex on PR #873, ten P2s: seven accepted and fixed here, three deferred to BACK-601).

1. Interactive --ready combined with --assignee, --unassigned or --parent resolved readiness against the prefiltered display list, so a dependency owned by someone else read as an unknown dependency and a blocked task could pass the filter. The interactive loader now returns the unfiltered corpus as readinessTasks, unified-view threads it to the viewer, and the viewer resolves readiness against it while still displaying only the filtered list. The one-shot plain and json paths were already correct because they used loadReadinessGraph.
2. Duplicate canonical identities in the graph were resolved first-wins, so the verdict depended on insertion order. An identity claimed by more than one record now resolves as unresolved and fails closed, per the manifesto's rule on ambiguous identity.
3. statuses: [] in config left no terminal status, so every dependency looked unfinished and everything was blocked. The CLI and server paths defaulted to DEFAULT_STATUSES but the interactive loader passed the empty array straight through. The default now resolves once inside createReadinessGraph, which covers every surface.
4. A record in backlog/completed whose status is not the currently configured terminal one (renamed statuses, or history from Core.completeTask) classified as unfinished and blocked its dependents permanently. Location in the completed corpus is now the completion evidence: completed records are passed separately and satisfy a dependency whatever their status string says.
5. The browser modal derived readiness from the persisted task.status and ignored the optimistic inline status state, so a task set to a terminal status inline still showed its blocked or ready badge until a refresh. It now depends on the edited status.
6. Completing a task with the TUI C shortcut removed it from the display list but left the startup completed snapshot stale, so dependents immediately flipped to 'Unknown dependency'. The shortcut now moves the record from the active side of the readiness graph to the completed side.
7. The id-to-task index was rebuilt for every evaluated candidate, which is quadratic on large ready-filters. It is built once per filter pass and passed through as a ReadinessGraph value. applyTaskFilters now takes ready?: ReadinessGraph instead of ready/statuses/readinessTasks, so readiness filtering cannot be requested without the graph it needs.

Deferred to BACK-601 (created off main, low priority, labels tui+web): draft-on-draft dependencies unresolvable in the browser, the readiness filter silently dropping when tabbing to the board, and cross-branch terminal dependencies missing from the graph under checkActiveBranches.

New coverage: duplicate-identity fail-closed in both insertion orders, renamed-terminal completed record, a task whose own record is completed, statuses: [] falling back to the default, readiness verdicts independent of the filters that narrowed the display list, a 2000-task scale guard that the quadratic version failed, CLI --ready with --assignee and --unassigned where the dependencies are hidden by the filter, and unified-view plumbing of the unfiltered corpus.

Rendered re-verification on the rebuilt binary: task list --ready --assignee @me returns only the task whose dependency is completed; the detail pane of the assignee-filtered list reports 'Blocked by TASK-2' for a dependency that is not in the list; completing that dependency with C leaves the dependent reading '✓ Ready to start' with the record confirmed in backlog/completed; and the browser badge switches off and back on immediately when the status is changed inline, with no console errors.

Verification after the review fixes: bun run test -> 2015 pass, 0 fail across 219 files, exit 0; bunx tsc --noEmit and bun run check . clean; bun run build clean. Follow-up task BACK-601 created on a branch off main so it lands independently of this PR.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Took over contributor PR #814 (cottrell) and landed dependency readiness guidance across the CLI, TUI, browser, and MCP. A shared getTaskReadiness(task, allTasks, statuses) helper derives readiness per task from its dependencies at read time, with no ordering or state semantics and no revival of the removed sequences model: resolved-but-unfinished dependencies are reported as blocking, dependency IDs that cannot be resolved are reported as unknown, and both fail closed. Surfaced through backlog task list --ready, the TUI detail pane, the browser task-details modal, and the existing MCP task_list tool.

David Cottrell's implementation is preserved as the first commit with his authorship. The adaptation replaced his full-graph loading strategy, which called core.loadTasks({includeCompleted:true}) unconditionally in the TUI (measured at 6.6s per call on this repo versus 1.7s for the normal load), fixed dependency resolution to use canonical task identity instead of raw string equality, separated unknown dependencies from blocked ones, removed a dead TaskListFilter.ready field, and reverted the fullGraphTasks plumbing through unified-view.

Verified with bunx tsc --noEmit, bun run check ., bun run build, and the full bun run test suite (1985 pass, 0 fail). Rendered QA on the built binary against a disposable project covering met, unmet, and completed-and-filed dependencies: TUI detail pane in tmux, task list --ready in plain, json and interactive modes, the browser modal in light and dark themes, and an MCP task_list stdio round-trip. Rendered QA also caught three defects the unit tests missed: a blessed wide-glyph rendering artifact in the TUI, a browser/CLI disagreement about completed dependencies, and an infinite render loop in the modal.
<!-- SECTION:FINAL_SUMMARY:END -->
