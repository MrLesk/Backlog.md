---
id: BACK-430
title: Create tasks from the TUI board
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - tui
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/579'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #579: allow users to create tasks directly from the terminal board view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The TUI board exposes a discoverable keybinding or command for task creation.
- [ ] #2 The create flow prompts for title and initial status at minimum.
- [ ] #3 After creation, the board refreshes and focuses the new task or its column.
- [ ] #4 Help text and tests/manual verification cover the flow.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
