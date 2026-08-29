---
id: BACK-548
title: Expose bidirectional dependency graphs in task details
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-16 21:38'
updated_date: '2026-08-29 23:14'
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
- [ ] #1 Canonical CLI task detail output shows direction-separated, complete forward dependencies and reverse dependents for the selected task, with direct relationships distinguishable from transitive relationships.
- [ ] #2 JSON task-view preserves the existing direct dependencies array and adds a documented, additive normalized graph representation with an explicit root, nodes, and directed edges for both traversals; task list and search summary contracts remain unchanged.
- [ ] #3 The graph is computed on demand for one selected task, represents each resolved node once, orders nodes and edges deterministically, and handles chains, branches, diamonds, and cycles without recursive duplication or unbounded output.
- [ ] #4 Missing dependency references and ambiguous task identities are represented explicitly and fail closed; the graph never guesses a target or silently reports an incomplete relationship as resolved.
- [ ] #5 Graph resolution follows canonical task-detail visibility and identity rules for current-checkout, completed, and configured cross-branch tasks, while archived task IDs are not resurrected after archive releases their identity.
- [ ] #6 TUI and browser task details show accessible, navigable forward and reverse dependency sections without expanding board cards, task-list rows, or search-result summaries, and keep editable direct dependencies separate from derived graph data.
- [ ] #7 The legacy MCP task-detail adapter exposes the same graph semantics only after the shared model and canonical CLI contract are defined; no MCP-first contract or separate dependency meaning is introduced.
- [ ] #8 Public CLI and agent documentation explains edge direction, direct versus transitive relationships, dependents terminology, visibility scope, cycle handling, and unresolved identity diagnostics.
- [ ] #9 Automated tests cover direct and multi-level forward and reverse traversal, diamonds, cycles, missing and ambiguous IDs, completed and cross-branch tasks, deterministic ordering, unchanged compact summary payloads, and payload growth without recursion explosion.
- [ ] #10 Rendered TUI and desktop-browser QA verifies readable forward and reverse graphs, keyboard and accessibility behavior, and best-effort narrow-screen behavior on representative deep, branching, cyclic, and unresolved examples.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
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
