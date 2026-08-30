---
id: BACK-548
title: Expose bidirectional dependency graphs in task details
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-16 21:38'
updated_date: '2026-08-30 12:37'
labels:
  - cli
  - tui
  - web
  - mcp
  - dependencies
dependencies:
  - BACK-545
type: enhancement
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task detail views should explain the complete dependency context around the selected task. For a uniquely resolved task, show both the full transitive set of tasks it depends on and the full transitive set of tasks that depend on it. Keep direct relationships identifiable, avoid recursive payload duplication, and preserve compact task list, search, and board-summary outputs. The CLI and shared task model are canonical; TUI and browser task details should present the same semantics, and MCP task detail should follow only as a legacy adapter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Canonical CLI task detail output shows direction-separated, complete forward dependencies and reverse dependents for the selected task, with direct relationships distinguishable from transitive relationships.
- [x] #2 JSON task-view preserves the existing direct dependencies array and adds a documented, additive normalized graph representation with an explicit root, nodes, and directed edges for both traversals; task list and search summary contracts remain unchanged.
- [x] #3 The graph is computed on demand for one selected task, represents each resolved node once, orders nodes and edges deterministically, and handles chains, branches, diamonds, and cycles without recursive duplication or unbounded output.
- [x] #4 Missing dependency references and ambiguous task identities are represented explicitly and fail closed; the graph never guesses a target or silently reports an incomplete relationship as resolved.
- [x] #5 Graph resolution follows canonical task-detail visibility and identity rules for current-checkout, completed, and configured cross-branch tasks, while archived task IDs are not resurrected after archive releases their identity.
- [x] #6 TUI and browser task details show accessible, navigable forward and reverse dependency sections without expanding board cards, task-list rows, or search-result summaries, and keep editable direct dependencies separate from derived graph data.
- [x] #7 The legacy MCP task-detail adapter exposes the same graph semantics only after the shared model and canonical CLI contract are defined; no MCP-first contract or separate dependency meaning is introduced.
- [x] #8 Public CLI and agent documentation explains edge direction, direct versus transitive relationships, dependents terminology, visibility scope, cycle handling, and unresolved identity diagnostics.
- [x] #9 Automated tests cover direct and multi-level forward and reverse traversal, diamonds, cycles, missing and ambiguous IDs, completed and cross-branch tasks, deterministic ordering, unchanged compact summary payloads, and payload growth without recursion explosion.
- [ ] #10 Rendered TUI and desktop-browser QA verifies readable forward and reverse graphs, keyboard and accessibility behavior, and best-effort narrow-screen behavior on representative deep, branching, cyclic, and unresolved examples.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared model. Add one dependency-graph module beside readiness so both share a single canonical identity, ambiguity, and completion rule: buildDependencyGraph(rootTask, { tasks, completedTasks, statuses }) returning { rootId, nodes, edges }. There is no existing reverse-dependency owner in the codebase, so this module becomes the single owner of the reverse edge.
2. Contract. Every edge is directed from the task that declares the dependency to the task it depends on. Nodes are unique per canonical identity and carry state (resolved, ambiguous, missing), completed, and the shortest dependencyDepth and dependentDepth, where 0 is the root, 1 is direct, greater than 1 is transitive, and null means not reachable in that direction. Both traversals are breadth-first with a visited set, so chains, branches, diamonds, and cycles terminate and never duplicate a node. Unresolved references become explicit nodes and are never traversed or counted as satisfied.
3. Visibility. The caller supplies the corpus, so each surface keeps its own canonical task-detail visibility. CLI and TUI use the current checkout plus completed records, matching task view today. The browser keeps its configured cross-branch corpus and gets the graph from the server rather than from the board list, because the task modal has no full corpus of its own. Archived records are never loaded, so an archived ID resolves as missing instead of being resurrected.
4. Determinism. Nodes are ordered root first then by compareTaskIds, edges by from then to with the same comparator. Rendered trees expand each node once and show later occurrences as a back-reference, so output stays linear in nodes plus edges.
5. Canonical CLI. Render direction-separated Depends on and Dependents sections in the shared plain-text task formatter, marking direct versus transitive, completed records, cycle and repeat references, and unresolved or ambiguous identities. The existing Dependencies line stays as the editable direct list. The section is omitted when the task has neither dependencies nor dependents.
6. JSON. taskViewJson gains an additive dependencyGraph object under schemaVersion 1 with root, nodes, and directed edges. The existing dependencies array is unchanged, and task-list plus search summary payloads are untouched.
7. TUI. Add the same direction-separated sections to the task detail pane using branch glyphs, scrollable and keyboard reachable, without touching board cards or task list rows.
8. Browser. Serve the graph with the single-task detail payload and render it web-natively with semantic list markup and accessible labels, no ASCII or glyph art, with links that navigate to each task. Editable direct dependencies stay in their own control.
9. MCP. Mirror the settled CLI contract in the legacy task detail adapter only after the shared model and CLI are done.
10. Docs. Document edge direction, direct versus transitive, dependents terminology, visibility scope, cycle handling, and unresolved identity diagnostics in the public CLI and agent instruction surfaces.
11. Tests. Cover direct and multi-level traversal in both directions, diamonds, cycles, self-references, missing and ambiguous IDs, completed and cross-branch records, deterministic ordering, unchanged list and search payloads, and bounded output on wide and deep graphs.
12. QA. Automate what a pty and jsdom can verify and list the remaining rendered TUI and desktop-browser checks for the maintainer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built one shared bidirectional dependency graph (src/utils/dependency-graph.ts) and moved canonical identity, ambiguity, and completion evidence into src/utils/task-record-index.ts so readiness and the graph resolve records by the same rule. There was no reverse-dependency owner anywhere in the codebase before this, so the new module is the single one.

Contract: every edge points from the task that declares the dependency to the task it depends on. Each reached identity is one node carrying the shortest dependencyDepth and dependentDepth, where 0 is the root, 1 is direct, higher is transitive, and null means unreachable that way. Both traversals are breadth-first with a visited set, and rendering expands each node once and marks later occurrences as (cycle) or (shown above). Missing and ambiguous identities become explicit nodes that are never traversed and never counted as satisfied.

The caller supplies the corpus, so each surface keeps its own task-detail visibility. The browser needed a server-side source because the modal only ever held the board list, so GET /api/tasks/:id/dependency-graph reads the working copy as written and lets the cross-branch store contribute only identities the working copy lacks. Without that, a locally duplicated ID would have been flattened to resolved by the store and the browser would have disagreed with the CLI.

Validation: bunx tsc --noEmit passed; bun run check . passed; full bun test run: 2608 pass, 7 skip, 3 fail, where the only 3 failures are the pre-existing "patched blessed emoji widths" tests, confirmed to fail identically against origin/main sources in this same worktree. New coverage is 44 tests across the shared model, CLI end-to-end, TUI detail, browser section, server endpoint, and MCP.

Rendered QA used a fixture with a five-deep chain, a diamond, a cycle, a completed dependency, an archived target, a dangling cross-branch reference, and an identity two files claim. CLI output was inspected for each case. The TUI was rendered through a real pty at 150x50 and 24x80; the section renders correctly at both, and at 24x80 long node lines wrap exactly as the existing Readiness line already does in that pane. The browser was driven live: the accessibility tree shows region, heading, and nested list/listitem with links for resolved nodes and plain text for unresolved ones, clicking a node navigates and re-resolves the graph, and a 375px viewport produces no horizontal page overflow.

AC #10 is left unchecked on purpose. Screenshots returned blank in this environment, so the browser evidence is accessibility-tree and DOM level and the TUI evidence is a decoded pty transcript. Pixel-level visual review of the TUI colours and the modal badge weights still needs the maintainer.

Reshaped on the maintainer ruling that the dependency graph is a property of the task detail, not something each interface acquires.

src/core/task-detail.ts is now the single detail read path: loadTaskCorpus is the one corpus loader (readiness shares it), and TaskDetail = Task & { dependencyGraph } makes the field required on the detail type instead of optional on Task, so a detail read cannot forget to populate it and the compact list, search, and board projections cannot pick it up by accident. The graph is derived at read time and never written to the Markdown record.

Deleted: the standalone web dependency-graph endpoint and route, its client method and payload type, the modal state/effect/fetch that consumed it, the CLI-side loadTaskDependencyGraph duplicate corpus load, the dependencyGraph options on the plain-text formatter and the TUI detail options, and the corpus triple-load inside loadReadinessGraph. JSON moved dependencyGraph from beside task onto task itself; CLI-INSTRUCTIONS.md and the agent guidance were updated to match.

Root cause of the double fetch the maintainer observed: the web app mounts inside React.StrictMode and the served bundle is a development React build, so React deliberately runs a mount effect, cleans it up, and runs it again. The modal graph fetch lived in such an effect and its cancelled flag only discarded the second response, not the second request. Neither effect dependency changed between the two calls, so only deliberate double-invocation can explain it. Folding the graph into the detail payload removes the effect, so the duplication is gone structurally rather than masked by a cache.

Measured in the running browser afterwards: opening a task makes exactly one /api/task/<id> request and zero dependency-graph requests, on both the click and deep-link paths; the old endpoint returns 404; the graph survives a save without disappearing or looping. Validation: bunx tsc --noEmit passed, bun run check . passed, bun test 2611 pass / 7 skip / 3 fail where the 3 are the pre-existing blessed emoji-width tests, and PR #960 CI is green on macOS, Ubuntu, and Windows.

Follow-up worth a decision: the modal still fetches completed dependencies by ID for the readiness badge, and those reads now also build a graph. The graph already carries each direct dependency title, status, and completed flag, so that fetch loop could be deleted and readiness derived from the graph, but that changes shipped BACK-546 behaviour so it was not folded in here.

Maintainer QA round two.

Ordering: the dependency graph now sits below the Definition of Done on all three surfaces, so description and the checklists stay at the top and the graph joins the context read before starting work. CLI plain order is Description, Acceptance Criteria, Definition of Done, Dependency Graph, Implementation Plan. The TUI and the web modal match. The web sidebar keeps its existing direct-dependencies picker and readiness badge untouched.

Navigation: reproduced and attributed rather than assumed. Board and task-list clicks are correct and untouched by this branch, and a board card opens at /board/<id>/<slug> without leaving the board. The defect is in task links inside the modal, which hardcode /tasks/<id> and so switch the reader from the Kanban Board to the All Tasks page. origin/main already ships that exact line in DependencyInput.tsx for the sidebar dependency chips, so the root cause predates this branch and is left for a separate task. This branch no longer adds new instances: the graph links build their href from the page the reader is already on, mirroring handleEditTask base-path logic. Verified live that a graph link from /board/TASK-12/selected now goes to /board/TASK-3/formatter-update and that a deep link to /tasks/TASK-3 still resolves; a jsdom test pins both.

Validation: bunx tsc --noEmit passed, bun run check . passed, bun test 2612 pass / 7 skip / 3 fail where the 3 are the pre-existing blessed emoji-width tests. One CI job (lint-and-unit-test on ubuntu) failed once on the MCP task_search cross-branch tripwire test; that test passed 5 of 5 locally and macOS and Windows passed, main carries commit af42e9e4 specifically hardening the same tripwire, and a rerun of the job went green, so it was a flake rather than a regression.

Maintainer QA round three, CLI plain layout.

The dependency graph now renders directly above Description in plain output and replaces the raw Dependencies ID list, which said strictly less than the graph. Modified files moved out of the header block down beside Implementation Plan and Implementation Notes, the things that change while the task is in progress. JSON is untouched: task.dependencies remains the editable direct list alongside task.dependencyGraph.

One judgement call worth the maintainer overruling if he disagrees. formatTaskPlainText also renders write confirmations for backlog task edit and every MCP task_edit and lifecycle result, and those carry no dependency graph. Removing the Dependencies field unconditionally would have left a dependency edit with nothing echoing what it had just set, which is a real loss on a write confirmation. So the field is dropped exactly where the graph replaces it and kept where there is no graph: task view shows no Dependencies line, task edit --plain still shows Dependencies: TASK-1. The three existing MCP confirmation assertions pass unchanged, which is the evidence that the confirmation contract held.

The TUI builds its detail from generateDetailContent, a separate section builder from the plain formatter, so it did not inherit the CLI move and was deliberately not hand-reordered. The TUI keeps its metadata Dependencies and Readiness lines and renders the graph below Definition of Done. The web modal is unchanged and approved as-is.

Validation: bunx tsc --noEmit passed, bun run check . passed, full bun test 2612 pass / 7 skip / 4 fail, where 3 are the pre-existing blessed emoji-width tests and the fourth is the known-flaky MCP task_search cross-branch tripwire, which passed 5 of 5 in isolation and only trips under full-suite concurrency; main carries commit af42e9e4 hardening that same tripwire. PR #960 CI is green on macOS, Ubuntu, and Windows.
<!-- SECTION:NOTES:END -->
