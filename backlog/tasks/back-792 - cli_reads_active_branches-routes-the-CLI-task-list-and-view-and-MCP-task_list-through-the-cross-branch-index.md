---
id: BACK-792
title: >-
  cli_reads_active_branches routes the CLI task list and view and MCP task_list
  through the cross-branch index
status: Done
assignee: []
created_date: '2026-10-24T07:34:00Z'
updated_date: '2026-10-24T07:34:00Z'
labels: []
dependencies: []
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since 1.50.1 the command-line task list, task view and task <id> and the MCP task_list read the working copy alone, deliberately, so they stay fast on slow networks. A project that wants those reads to agree with the board, which reads across active branches, has no way to say so: the same task reads To Do in the list while the board shows the In Progress its branch carries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With cli_reads_active_branches unset, task list, task view, task <id> and MCP task_list behave exactly as before
- [x] #2 With cli_reads_active_branches: true, the four reads report the status the board reports, across active branches
- [x] #3 backlog config get, set and list handle cliReadsActiveBranches and the YAML key round-trips through the config file
- [x] #4 The README and the CLI and MCP guides document the key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add BacklogConfig.cliReadsActiveBranches (YAML cli_reads_active_branches, default off), parsed and serialized beside check_active_branches; Core.cliReadsActiveBranches() reads it; the four read sites pass it as includeCrossBranch and the MCP list skips its working-copy filter when it is on; config get/set/list know the key; README and the CLI and MCP guides document it; tests for the round-trip and for each read with the key off and on.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Builds on the strategy-first resolution fix (#1024): a status a branch carries can only be shown once the index prefers it, so this change's test needs that fix. Lifecycle writes still resolve the working copy.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An opt-in key, off by default, makes the four working-copy reads read across active branches like the board.
<!-- SECTION:FINAL_SUMMARY:END -->
