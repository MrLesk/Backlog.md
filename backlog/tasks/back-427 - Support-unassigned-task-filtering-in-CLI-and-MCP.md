---
id: BACK-427
title: Support unassigned task filtering in CLI and MCP
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-04 17:47'
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
- [x] #1 CLI task list can filter for tasks with no assignee.
- [x] #2 MCP task_list exposes an equivalent unassigned filter without overloading a real assignee value ambiguously.
- [x] #3 Help text, schemas, and tests cover the new filter.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add unassigned?: boolean to TaskListFilter (src/types/index.ts)
2. Implement the filter once in Core.applyTaskFilters (src/core/backlog.ts) so both the plain-list and search paths of queryTasks share it (covers CLI plain, CLI interactive, MCP)
3. CLI: add --unassigned flag to task list, mutually exclusive with --assignee (clear error), update help schema and interactive filter title
4. MCP: add unassigned boolean to taskListSchema with description, validate assignee+unassigned conflict in TaskHandlers.listTasks, support draft status path, clarify task_list tool description
5. Tests: cli.test.ts (--unassigned filtering + conflict error), mcp-tasks.test.ts (unassigned filtering incl. drafts + conflict rejection)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented unassigned filtering: TaskListFilter.unassigned flows through Core.applyTaskFilters (single shared implementation covering plain, interactive, and search paths). CLI gained --unassigned on task list with a mutual-exclusion error against --assignee; MCP task_list gained an unassigned boolean with schema description, handler validation, and draft-path support. Tool description clarified. Tests added in cli.test.ts and mcp-tasks.test.ts; targeted runs green, full suite running.

Validation: bunx tsc --noEmit clean; biome check clean; full bun test run 1382 pass / 2 skip / 1 fail — the one failure (cli-priority-filtering case-insensitive 5s timeout) reproduces identically on pristine origin/main (d0f3cff) and is a pre-existing flake unrelated to this change. Earlier full-run failures were caused by a stale worktree node_modules missing @tailwindcss/cli, fixed with bun i.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added unassigned task filtering to CLI and MCP (issue #557). TaskListFilter gained an unassigned flag implemented once in Core.applyTaskFilters, shared by CLI plain output, CLI interactive view, and MCP task_list. CLI: new --unassigned flag on backlog task list, mutually exclusive with --assignee (clear error), documented in help schema. MCP: task_list accepts unassigned: true (boolean schema with description), rejects combining it with assignee, and applies the filter in the Draft status path too; tool description now enumerates filters. Shipped instruction guides mention the new filter. Verified with new tests in cli.test.ts and mcp-tasks.test.ts plus full suite (1382 pass; single failure is a pre-existing cli-priority-filtering timeout flake reproduced on pristine main).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
