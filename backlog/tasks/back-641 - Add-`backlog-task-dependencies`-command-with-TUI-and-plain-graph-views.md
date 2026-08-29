---
id: BACK-641
title: Add `backlog task dependencies` command with TUI and plain graph views
status: To Do
assignee: []
created_date: '2026-08-29 17:53'
updated_date: '2026-08-29 17:57'
labels:
  - cli
  - tui
  - mcp
  - dependencies
dependencies:
  - BACK-548
references:
  - 'https://mdx-graphs.kshv.me/docs/graph-tree'
  - 'https://mdx-graphs.kshv.me/docs/graph-gantt'
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give users and agents a dedicated view of a task's dependency graph from the terminal. Interactive use opens a TUI graph; `--plain` prints deterministic text for agents and scripts; MCP exposes the same view. The graph semantics, traversal, and fail-closed identity rules come from the shared model defined by BACK-548; this command is a presentation surface over that model. Web graph exploration is tracked separately in BACK-553.

Visual direction (maintainer-suggested, not binding): borrow the ASCII visual language of mdx-graphs (MIT, references below) rather than the library itself, which is React/MDX and unusable in the TUI. Its graph-tree branch glyphs suit the blocked-by/blocks chains; its graph-gantt shade-glyph bars with progress fill could render the graph as work order (bar position from dependency depth, since tasks have no dates; fill from acceptance-criteria progress). Whether the gantt-style view ships is an implementation-plan decision for review, not a committed requirement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running `backlog task dependencies <id>` in a TTY opens a TUI view showing the upstream blocked-by graph and downstream dependents of the task, with direct vs transitive relationships distinguishable
- [ ] #2 `--plain` prints a deterministic text rendering of the same graph, and `--json` exposes the normalized graph representation defined by BACK-548
- [ ] #3 MCP exposes the same dependency-graph view for a task with content equivalent to the `--plain` output
- [ ] #4 Missing references, ambiguous identities, and cycles are rendered explicitly and fail closed; the view never invents edges or reports unresolved relationships as resolved
- [ ] #5 CLI help and shipped agent instructions document the command, its flags, and edge-direction semantics
- [ ] #6 Automated tests cover chains, branches, diamonds, cycles, and unresolved IDs across TUI snapshot or render checks, plain, json, and MCP outputs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
