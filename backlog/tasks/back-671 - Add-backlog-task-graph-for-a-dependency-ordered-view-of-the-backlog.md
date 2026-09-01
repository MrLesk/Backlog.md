---
id: BACK-671
title: Add backlog task graph for a dependency-ordered view of the backlog
status: To Do
assignee: []
created_date: '2026-09-01 06:27'
labels: []
dependencies: []
ordinal: 303000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A standalone dependency surface only earns its place when it shows relationships across the whole backlog, which no task detail can: what blocks what, the work order, and what is startable now. `backlog task graph` renders the task list in dependency-depth layout, borrowing the visual language of mdx-graphs graph-gantt (MIT, https://mdx-graphs.kshv.me/docs/graph-gantt) rather than the library, which is React/MDX and unusable in a terminal. Tasks have no dates, so horizontal position comes from dependency depth: a task sits to the right of everything blocking it, and the leftmost column is the ready set. Bar fill comes from acceptance-criteria progress and must reuse the compact bar shipped by BACK-666, including its ASCII fallback for terminals without Block Elements (BACK-657). Follows the house convention of one modifier: bare command opens the interactive view in a TTY, --plain prints the same rendering as deterministic text. Graph data is the derived dependency field from BACK-548; this command only lays it out. Scale matters: a 700-task backlog cannot render as 700 rows, so the default scope excludes terminal-status tasks and the existing task list filters apply. The web equivalent is BACK-553 and must not use glyph art.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog task graph opens an interactive dependency-ordered view of the backlog in a TTY, with horizontal position from dependency depth so blocked tasks sit right of what blocks them
- [ ] #2 backlog task graph --plain prints the same layout as deterministic text suitable for agents
- [ ] #3 Rows show acceptance-criteria progress using the existing compact bar and its ASCII fallback, and the leftmost, unblocked column is marked as ready
- [ ] #4 The default scope excludes terminal-status tasks, and the existing task list filters (status, exclude-status, ready, assignee, parent, labels, limit) apply to the graph view
- [ ] #5 Unresolved, ambiguous, and cyclic relationships render explicitly and fail closed, never as resolved or invented edges
- [ ] #6 Layout comes from the derived dependency graph on task details with no new computation path, endpoint, or per-surface loader
- [ ] #7 Automated tests cover depth ordering, ready marking, cycles, unresolved identities, filter composition, and plain output determinism
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
