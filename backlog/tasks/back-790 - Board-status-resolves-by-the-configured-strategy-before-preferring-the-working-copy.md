---
id: BACK-790
title: >-
  Board status resolves by the configured strategy before preferring the working
  copy
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
With check_active_branches on and the most_progressed strategy, a task that is To Do in the working copy and In Progress on an active branch is loaded from that branch and then shown as To Do: selectTaskRecord sorts the working copy ahead of every branch copy before the strategy is consulted (#1024). The board, the web UI and the MCP task_view show the working copy's status until the branch merges, so a task under way on a branch looks untouched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A task To Do in the working copy and In Progress on an active branch shows In Progress on the board, the web UI and MCP task_view under most_progressed
- [x] #2 A task Done in the working copy and In Progress on a stale branch keeps showing Done
- [x] #3 With equal status the working copy is shown whatever the branch copy's commit date
- [x] #4 most_recent keeps the working copy ahead as before
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reorder the comparator in selectTaskRecord (src/core/task-identity-index.ts): status rank first under most_progressed, then the working copy, then last-modified time, then the record key. The working copy is not compared with a branch copy by time (its time is the file's updated_date, a branch copy's is a commit date), so it wins a tie of status. Move the tests that encoded working-copy-first to the strategy's rule.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed src/core/task-identity-index.ts. Tests: task-identity-index.test.ts (five new cases); core.test.ts and server-tasks-spa-fallback.test.ts (two expectations now follow the strategy: a Done branch copy is shown over a To Do working copy).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Under most_progressed the copy with the furthest status is shown; the working copy wins a tie of status; most_recent is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
