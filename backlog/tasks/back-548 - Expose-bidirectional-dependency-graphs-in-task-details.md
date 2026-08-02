---
id: BACK-548
title: Expose bidirectional dependency graphs in task details
status: To Do
assignee: []
created_date: '2026-07-16 21:38'
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
