---
id: BACK-642
title: Show acceptance criteria progress in MCP and plain task lists
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-29 17:53'
updated_date: '2026-08-30 15:18'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add shared helper formatAcceptanceCriteriaSummarySuffix(task) in src/ui/acceptance-criteria-progress.ts returning ' (ac: checked/total)' when the task has acceptance criteria, empty string otherwise (no status gate; lists show progress for any task with criteria).
2. Append the suffix in the CLI plain list row formatter (formatPlainTaskListRow in src/cli.ts) and the MCP list summary line (formatTaskSummaryLine in src/mcp/tools/tasks/handlers.ts), after the status suffix. Keep the two line formatters separate; only the AC fragment is shared. Do not touch formatTaskPlainText or task detail output (PR #960 overlap).
3. Add tests in src/test/cli-task-list.test.ts and src/test/mcp-tasks.test.ts covering list output with and without criteria on both surfaces.
4. Leave task list --json unchanged. Verify with bunx tsc --noEmit, bun run check ., bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added shared formatAcceptanceCriteriaSummarySuffix in src/ui/acceptance-criteria-progress.ts and wired it into formatPlainTaskListRow (cli.ts) and MCP formatTaskSummaryLine. Tests added in cli-task-list.test.ts and mcp-tasks.test.ts (with/without criteria). tsc and biome clean; full suite running.
<!-- SECTION:NOTES:END -->
