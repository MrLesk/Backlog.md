---
id: BACK-671
title: Add a dependency-ordered graph layout to task list
status: To Do
assignee: []
created_date: '2026-09-01 06:27'
updated_date: '2026-09-01 06:28'
labels: []
dependencies: []
ordinal: 303000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A dependency surface only earns its place when it shows relationships across the whole backlog, which no task detail can: what blocks what, the work order, and what is startable now. `backlog task list --graph` prints the task list in dependency-depth layout, borrowing the visual language of mdx-graphs graph-gantt (MIT, https://mdx-graphs.kshv.me/docs/graph-gantt) rather than the library, which is React/MDX and unusable in a terminal. It is a rendering option on task list rather than a new command, so every existing filter composes with it for free. Like --json, --graph is a printing mode: it never opens the interactive list, so there is no TUI to build and no second modifier to stack. Tasks have no dates, so horizontal position comes from dependency depth: a task sits to the right of everything blocking it, and the leftmost column is the ready set. Bar fill comes from acceptance-criteria progress and must reuse the compact bar shipped by BACK-666, including its ASCII fallback for terminals without Block Elements (BACK-657). Graph data is the derived dependency field from BACK-548; this only lays it out. Scale matters: a 700-task backlog cannot render as 700 rows, so the default scope excludes terminal-status tasks and existing filters narrow it further. The web equivalent is BACK-553 and must not use glyph art. The standalone per-task command this replaces is removed in BACK-670.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog task list --graph prints a dependency-ordered text layout where horizontal position comes from dependency depth, so a task sits right of everything blocking it
- [ ] #2 --graph prints and never opens the interactive list, the same way --json does, and combining it with --json is rejected
- [ ] #3 Rows show acceptance-criteria progress using the existing compact bar and its ASCII fallback, and the leftmost unblocked column is marked as ready
- [ ] #4 The default scope excludes terminal-status tasks, and the existing task list filters (status, exclude-status, ready, assignee, parent, labels, limit) compose with --graph
- [ ] #5 Unresolved, ambiguous, and cyclic relationships render explicitly and fail closed, never as resolved or invented edges
- [ ] #6 Layout comes from the derived dependency graph on task details with no new computation path, endpoint, or per-surface loader
- [ ] #7 Automated tests cover depth ordering, ready marking, cycles, unresolved identities, filter composition, and output determinism
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
