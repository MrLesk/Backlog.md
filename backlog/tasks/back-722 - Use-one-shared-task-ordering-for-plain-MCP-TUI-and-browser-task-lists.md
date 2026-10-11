---
id: BACK-722
title: 'Use one shared task ordering for plain, MCP, TUI, and browser task lists'
status: To Do
assignee: []
created_date: '2026-10-11 10:42'
labels:
  - enhancement
dependencies:
  - BACK-721
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1071'
type: enhancement
ordinal: 340000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The interactive `backlog task list` orders tasks with its own logic. A user who orders work with priority and `--ordinal` sees `backlog task list --plain --sort ordinal` print that order, while the interactive list groups by priority and then sorts by task ID, so the order set from the CLI and the order shown in the terminal UI disagree (issue #1071, 1.53.0). The maintainer confirmed that the TUI list has separate ordering logic and that list ordering belongs in one common handler used by every interface: plain, MCP, TUI, and browser.

The issue also asks to show each task's priority on TUI list rows, as plain output does. That request is not confirmed yet and is settled during plan review.

Depends on BACK-721, which corrects how plain output selects tasks after sorting; this task builds on that ordering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For the same filters and sort options, the interactive `backlog task list` shows tasks in the same order that `backlog task list --plain` prints them.
- [ ] #2 Task list ordering for plain, MCP, TUI, and browser comes from one shared ordering; no interface keeps its own separate list ordering logic.
- [ ] #3 For the same tasks and the same sort, the plain, MCP, TUI, and browser task lists present tasks in the same order.
- [ ] #4 The order printed by `backlog task list --plain` and `--json` does not change for any `--sort` value.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
