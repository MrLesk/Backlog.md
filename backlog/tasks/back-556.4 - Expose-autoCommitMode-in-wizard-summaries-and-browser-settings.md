---
id: BACK-556.4
title: 'Expose autoCommitMode in wizard, summaries, and browser settings'
status: To Do
assignee: []
created_date: '2026-07-28 14:47'
labels:
  - web-ui
  - cli
dependencies:
  - BACK-556.3
parent_task_id: BACK-556
priority: low
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose `autoCommitMode` in the human-facing configuration surfaces once BACK-556.3 has established it in the shared model and canonical CLI.

This covers the advanced CLI wizard, initialization and configuration summaries, and browser initialization and Settings. These surfaces must not weaken the validation established in BACK-556.3, and they must explain the choice in human-readable copy: `amend-own` rewrites the most recent Backlog commit rather than adding a new one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The advanced CLI wizard offers autoCommitMode, defaults to the current configured value, and presents it in a way that makes sense only when auto commit is enabled.
- [ ] #2 Initialization and configuration summaries show the effective autoCommitMode.
- [ ] #3 Browser initialization and Settings expose autoCommitMode, reject invalid values, and round-trip through the shared typed and serialized configuration paths.
- [ ] #4 Human-readable copy on the CLI wizard and browser surfaces states that amend-own rewrites the most recent Backlog commit rather than adding a new one.
- [ ] #5 Tests cover wizard defaults and output, summary rendering, and browser initialization and Settings round-trips.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
