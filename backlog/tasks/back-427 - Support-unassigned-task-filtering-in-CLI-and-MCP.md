---
id: BACK-427
title: Support unassigned task filtering in CLI and MCP
status: In Progress
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-04 13:50'
labels:
  - cli
  - mcp
  - filters
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/557'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #557: allow users and agents to list tasks with no assignee.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI task list can filter for tasks with no assignee.
- [ ] #2 MCP task_list exposes an equivalent unassigned filter without overloading a real assignee value ambiguously.
- [ ] #3 Help text, schemas, and tests cover the new filter.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add unassigned?: boolean to TaskListFilter (src/types/index.ts)
2. Implement the filter once in Core.applyTaskFilters (src/core/backlog.ts) so both the plain-list and search paths of queryTasks share it (covers CLI plain, CLI interactive, MCP)
3. CLI: add --unassigned flag to task list, mutually exclusive with --assignee (clear error), update help schema and interactive filter title
4. MCP: add unassigned boolean to taskListSchema with description, validate assignee+unassigned conflict in TaskHandlers.listTasks, support draft status path, clarify task_list tool description
5. Tests: cli.test.ts (--unassigned filtering + conflict error), mcp-tasks.test.ts (unassigned filtering incl. drafts + conflict rejection)
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
