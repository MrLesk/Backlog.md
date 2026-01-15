---
id: BACK-333
title: Keep cross-branch tasks out of plain CLI/MCP listings
status: Done
assignee:
  - '@codex'
created_date: '2025-12-03 19:29'
updated_date: '2025-12-03 19:34'
labels:
  - cli
  - mcp
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plain/task list outputs (including MCP tools) now include cross-branch tasks from the content store, but mutations are local-only. This surfaces uneditable tasks in plain listing interfaces and MCP results. Filter out non-local tasks for plain/agent outputs (CLI --plain, MCP task list/search) so only current-branch tasks appear, or otherwise mark/remove cross-branch ones to avoid unusable entries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Plain CLI task listings (including --plain variants) do not surface cross-branch/remote tasks; only current-branch/local tasks appear.
- [x] #2 MCP task list/search responses exclude cross-branch tasks unless they are editable locally; no unusable tasks are returned.
- [x] #3 Mutating CLI/MCP commands avoid "Task not found" by not offering cross-branch tasks in plain outputs; behavior is documented with clear branching message if needed.
- [x] #4 Tests updated/added to cover plain listing filtering and ensure cross-branch tasks remain available in interactive UI where read-only messaging exists.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plain CLI paths now query with includeCrossBranch=false and search outputs filter local-editable tasks; MCP task list/search handlers filter out remote/local-branch tasks via shared helper. Added isLocalEditableTask utility and unit coverage (src/test/mcp-tasks-local-filter.test.ts). All tests and tsc pass; biome check reports pre-existing noExplicitAny warnings in src/test/find-task-in-branches.test.ts.
<!-- SECTION:NOTES:END -->
