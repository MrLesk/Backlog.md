---
id: BACK-475
title: proper opencode integration
status: To Do
assignee:
  - '@lenucksi'
created_date: '2026-05-08 20:35'
updated_date: '2026-05-17 20:27'
labels: []
milestone: m-11
dependencies: []
priority: low
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
see if for an integration into opencode cli+mcp would be sufficient or if there is any merit to couple that deeper, maybe with session triggers / creation /  ... or an opencode worktree feature or something. 

they shouldn't merge but find out if there's something. people asked for integration with beads, this is sort-of similar.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
