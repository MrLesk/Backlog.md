---
id: BACK-566
title: Temporarily disable TUI task creation entrypoint
status: To Do
assignee: []
created_date: '2026-08-02 21:20'
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
Temporarily remove the released TUI task-creation entrypoint while BACK-565 repairs the composer UX. The board must stop advertising and opening the broken Create Task flow from the TUI, while CLI, Web UI, and MCP task creation remain unchanged. This is a short-lived mitigation; re-enable the TUI entrypoint only after BACK-565 passes its interactive UX and regression gates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The TUI board no longer advertises the task-creation shortcut or action while this mitigation is active.
- [ ] #2 The TUI task-creation shortcut cannot open the broken composer and produces no task, draft, modal, or unintended navigation side effect.
- [ ] #3 Existing TUI list, board, search, filter, view-switching, and task-editing interactions remain unchanged.
- [ ] #4 CLI, Web UI, and MCP task creation remain available and unchanged.
- [ ] #5 Automated regression coverage proves the disabled TUI entrypoint and preserves neighboring navigation behavior.
- [ ] #6 The task records that re-enabling the entrypoint is gated on BACK-565 completion and fresh rendered PTY verification.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
