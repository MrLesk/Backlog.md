---
id: BACK-474
title: >-
  Sequence / Dependency Visualizer Research — status review of BACK-217/218
  cluster + library evaluation
status: To Do
assignee:
  - '@lenucksi'
created_date: '2026-05-08 20:32'
updated_date: '2026-05-13 10:12'
labels:
  - sequences
  - research
  - visualization
  - dependencies
dependencies: []
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

BACK-474 was originally a stub for a sequence visualizer but duplicates the intent of the BACK-217 cluster and BACK-218. Before any new visualization code is written, this research task must:

1. Conduct a status audit of all related existing tasks: BACK-217 (parent — web UI + drag-and-drop), BACK-217.01 (completed: server endpoints), BACK-217.02 (list sequences web UI), BACK-217.03 (move tasks web UI), BACK-217.04 (web UI tests), BACK-218 (docs + tests)
2. Produce a gap analysis: what is done, what is open, what overlaps, what is obsolete
3. Research lightweight visualization libraries suitable for rendering dependency graphs in the browser (no GraphViz binary, no heavy PM tools)

**Goal**: Produce a concise report as updated implementation notes in this task or a linked `docs/` decision document, covering:
- Status of BACK-217.* and BACK-218: done / open / blocked / obsolete — with a recommendation on each (close, continue, split, replace)
- At least 3 lightweight JS/TS visualization library options evaluated (e.g. d3-dag, dagre-d3, elkjs + react-flow, vis-network, frappe-gantt) — scored by bundle size, maintenance status (last release, GitHub stars/activity), API simplicity, Bun/ESM compatibility
- UX pattern recommendation: force-directed graph vs. GANTT vs. topological list with visual connectors — what fits task dependencies best
- Whether dependency graph data should be exposed via MCP so AI agents can use it for planning (proposed data shape for `GET /api/sequences` or a new endpoint)
- Final recommendation: one primary library/approach with brief justification and bundle-size + license noted
- Proposed next steps: which of BACK-217.* / BACK-218 to close/continue/replace, and any new tasks to create in follow-up sessions

No code is written in this task. Implementation follows in separate tasks.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Status table produced for BACK-217, BACK-217.01, BACK-217.02, BACK-217.03, BACK-217.04, BACK-218 with per-task recommendation (close / continue / replace)
- [ ] #2 At least 3 visualization library options evaluated in a pros/cons table (bundle size, maintenance, ESM/Bun compatibility, API simplicity)
- [ ] #3 One primary approach recommended with justification, bundle size, and license
- [ ] #4 UX sketch (ASCII diagram or written description) of the intended dependency visualization in WebUI
- [ ] #5 MCP data shape proposal included (JSON shape for dependency graph consumption by AI agents)
- [ ] #6 Proposed next steps written as stub task descriptions ready to be created in follow-up sessions
- [ ] #7 No code changes in this task — research and documentation output only
<!-- AC:END -->
