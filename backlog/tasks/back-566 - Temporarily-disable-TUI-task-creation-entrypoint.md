---
id: BACK-566
title: Temporarily hide TUI task creation entrypoint
status: To Do
assignee: []
created_date: '2026-08-02 21:20'
updated_date: '2026-08-02 21:29'
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
- [ ] #1 The TUI board renders no task-creation button, action, shortcut, or help entry while this mitigation is active.
- [ ] #2 The former TUI task-creation shortcut cannot open the composer and produces no task, draft, modal, or unintended navigation side effect.
- [ ] #3 Existing TUI list, board, search, filter, view-switching, and task-editing interactions remain unchanged.
- [ ] #4 CLI, Web UI, and MCP task creation remain available and unchanged.
- [ ] #5 Automated regression coverage proves the TUI creation entrypoint is hidden and preserves neighboring navigation behavior.
- [ ] #6 The task records that re-enabling the hidden entrypoint is gated on BACK-565 completion and fresh rendered PTY verification.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
