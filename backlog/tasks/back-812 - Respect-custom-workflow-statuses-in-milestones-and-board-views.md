---
id: BACK-812
title: Respect custom workflow statuses in milestones and board views
status: Done
assignee:
  - '@codex'
created_date: '2026-11-19T23:09:00Z'
updated_date: '2026-11-19T23:23:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1224
  - src/utils/terminal-status.ts
  - src/core/milestones.ts
  - src/web/lib/lanes.ts
  - src/readme.ts
modified_files:
  - src/web/utils/milestones.test.ts
  - src/test/web-milestones-page-unassigned-filter.test.tsx
  - src/test/readme-board.test.ts
  - src/test/web-board-filters.test.tsx
  - src/web/lib/lanes.test.ts
  - src/test/subtask-ordering-consistency.test.ts
  - src/test/cli-plain-output.test.ts
  - src/core/milestones.ts
  - src/web/utils/milestones.ts
  - src/web/components/MilestonesPage.tsx
  - src/web/lib/lanes.ts
  - src/web/components/Board.tsx
  - src/board.ts
  - src/readme.ts
  - src/guidelines/mcp/task-creation.md
  - src/guidelines/mcp/task-execution.md
  - src/ui/board.ts
  - src/ui/status-icon.ts
  - src/formatters/task-plain-text.ts
  - src/ui/task-row-prefix.ts
  - src/ui/task-viewer-with-search.ts
  - src/commands/overview.ts
  - src/ui/overview-tui.ts
  - src/web/App.tsx
  - src/web/components/Statistics.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/TaskColumn.tsx
  - src/test/dependency-graph.test.ts
  - src/test/statistics.test.ts
  - src/utils/terminal-status.ts
  - src/core/statistics.ts
  - src/utils/dependency-graph.ts
  - src/test/board-popup-sync.test.ts
  - src/test/mcp-server.test.ts
  - src/test/tui-task-project.test.ts
priority: medium
type: bug
ordinal: 412000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A board can have DONE as an intermediate column and CLOSED as the last one. Milestones can then hide unfinished work and report finished work as active. Board ordering and finished-task marks also disagree with project statistics, agents are told to skip an active status, and README board exports can lose custom column headings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestone counts, active and completed lists, unassigned work and browser board progress follow the last configured status, including when names contain Done or Complete.
- [x] #2 Finished-task ordering and completion marks follow the configured workflow while preserving manual card ordering and the existing behavior for the default workflow.
- [x] #3 README board exports include the configured column headings and task rows for custom workflows.
- [x] #4 The shipped agent task-search guidance identifies unfinished work using the project's configured statuses.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend existing tests for custom milestone visibility, board progress and ordering, finished marks, and README headings.
2. Use the existing final-status rule wherever those views identify finished work. Preserve configured column order and manual card order, render README headings from the board, and correct the search instructions.
3. Verify the CLI and browser views on a custom board, run the type, style and relevant test checks, then open a reviewed PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced the reversed milestone percentages, hidden unfinished work, misleading check marks and missing export headings before the changes. Verified with the compiled CLI and Chrome that an unfinished DONE task stays active at 0%, a CLOSED task is finished at 100%, and unassigned work and README headings are visible as expected. The same cards and counts stayed correct after changing the column labels to Done and Closed. Checked a live terminal popup after reordering the workflow and a legacy draft sharing a task ID. Type checking, Biome, 315 focused tests and all 11 interactive terminal checks passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Custom workflows now use the final configured column for milestone visibility and progress, board ordering and finished-task marks. Older records keep their place if a column changes capitalization. README board exports keep their headings, and the MCP search guide points agents to the configured active columns.
<!-- SECTION:FINAL_SUMMARY:END -->
