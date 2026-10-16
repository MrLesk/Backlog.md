---
id: BACK-566
title: Temporarily hide TUI task creation entrypoint
status: Done
assignee:
  - '@alex'
created_date: '2026-08-02 21:20'
updated_date: '2026-08-02 21:32'
labels:
  - tui
  - release-mitigation
dependencies: []
references:
  - BACK-565
priority: high
type: chore
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Temporarily hide the released TUI task-creation entrypoint while BACK-565 repairs the composer UX. The TUI board must render no task-creation action and advertise no task-creation shortcut during this mitigation. CLI, Web UI, and MCP task creation remain unchanged. This is a short-lived mitigation; re-enable the TUI entrypoint only after BACK-565 passes its interactive UX and regression gates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The TUI board no longer advertises the task-creation shortcut or action while this mitigation is active.
- [x] #2 The TUI task-creation shortcut cannot open the broken composer and produces no task, draft, modal, or unintended navigation side effect.
- [x] #3 Existing TUI list, board, search, filter, view-switching, and task-editing interactions remain unchanged.
- [x] #4 CLI, Web UI, and MCP task creation remain available and unchanged.
- [x] #5 Automated regression coverage proves the disabled TUI entrypoint and preserves neighboring navigation behavior.
- [x] #6 The task records that re-enabling the entrypoint is gated on BACK-565 completion and fresh rendered PTY verification.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the board-only N shortcut handler and its Create a task help entry, without changing the composer or shared task creation APIs.
2. Remove the now-unreachable board creation callback plumbing and add a focused regression that N opens no composer while adjacent board navigation still works.
3. Verify TUI and help behavior, type-check and lint, then record that re-enabling requires BACK-565 completion and fresh rendered PTY verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the board creation action, N shortcut, and help copy. Re-enablement remains gated on BACK-565 completion plus fresh rendered PTY verification. Verified with focused TUI/help and board tests, MCP task-creation tests, TypeScript, and Biome.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Temporarily removed the TUI board task-creation entrypoint. Verified N opens no composer while column navigation remains available; CLI/MCP creation coverage remains green. Re-enable only after BACK-565 and fresh rendered PTY verification.
<!-- SECTION:FINAL_SUMMARY:END -->
