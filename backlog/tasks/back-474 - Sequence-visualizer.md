---
id: BACK-474
title: Sequence visualizer
status: To Do
assignee: []
created_date: '2026-05-08 20:32'
updated_date: '2026-05-11 14:01'
labels: []
dependencies: []
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wie can do dependencies of tasks. apparently there is a concept of sequences already. with those we can effectively make larger graphs of dependencies, possibly GANTT, possibly like graphviz, also we can calculate execution order and critical paths.

we want a visualization of those sequences
wie also want something that shows execution order and critical paths. it might be really useful to expose those in mcp too so that the ai can use that in their planning process.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
