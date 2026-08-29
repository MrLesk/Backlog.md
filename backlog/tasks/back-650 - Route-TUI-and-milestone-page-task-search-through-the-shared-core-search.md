---
id: BACK-650
title: Route TUI and milestone-page task search through the shared core search
status: To Do
assignee: []
created_date: '2026-08-29 21:04'
updated_date: '2026-08-29 21:04'
labels:
  - tui
  - web
dependencies:
  - BACK-649
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stage 2 of the search unification, after the config single-sourcing task: the TUI task viewer uses both createTaskSearchIndex and SearchService with a hand-rolled duplicate of milestone/labelMatch/ready post-filtering (~60 lines) in its SearchService branch; MilestonesPage runs a third private in-browser Fuse over id/title with its own weights. Collapse the TUI fallback branch onto the shared index and route MilestonesPage through the shared config or the /api/search endpoint, deleting the private implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The TUI task viewer's SearchService fallback branch and its hand-rolled post-filters are collapsed onto the shared search path
- [ ] #2 MilestonesPage no longer ships a private Fuse configuration
- [ ] #3 Search behavior in TUI and milestones view matches the other surfaces for the same query
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
