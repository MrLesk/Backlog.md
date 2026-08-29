---
id: BACK-642
title: Show acceptance criteria progress in MCP and plain task lists
status: To Do
assignee: []
created_date: '2026-08-29 17:53'
labels:
  - cli
  - mcp
dependencies: []
ordinal: 277000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
External tools can already read per-task acceptance criteria progress from `backlog task list --json` (`acceptanceCriteriaCompleted` / `acceptanceCriteriaCount`), and the TUI board/list and web UI render it. The remaining gaps are the MCP task list summary lines and `backlog task list --plain`, which show no AC progress. Close those gaps so every list surface reports the same progress.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MCP task list summary lines include acceptance criteria progress as completed/total for each task that has criteria
- [ ] #2 `backlog task list --plain` includes the same completed/total progress per task
- [ ] #3 Tasks without acceptance criteria render without progress noise, consistently across both surfaces
- [ ] #4 Automated tests cover MCP list and plain list output with and without acceptance criteria
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
