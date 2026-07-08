---
id: BACK-355.03
title: 'MCP: Add type parameter to task_create and task_edit tools'
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-01-01 23:37'
updated_date: '2026-07-04 18:15'
labels:
  - mcp
dependencies:
  - task-355.01
parent_task_id: BACK-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update MCP tool schemas to support the type field, enabling AI agents to categorize tasks during creation and modification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task_create tool schema includes optional 'type' parameter with enum validation
- [x] #2 task_edit tool schema includes optional 'type' parameter
- [x] #3 task_view output includes type field
- [x] #4 task_list output includes type for each task
- [x] #5 MCP tool descriptions document the type field and valid values
- [x] #6 Integration tests verify type handling in MCP tools
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add generateTypeFieldSchema(config) in src/mcp/utils/schema-generators.ts mirroring the status pattern: dynamic enum from config.types (fallback DEFAULT_TASK_TYPES), enumCaseInsensitive, description listing valid values, no default (absent = untyped). Wire into generateTaskCreateSchema and generateTaskEditSchema next to priority.
2. Add type?: string to TaskCreateArgs (src/mcp/tools/tasks/handlers.ts) and pass through createTaskFromInput; add type?: string to TaskEditArgs (src/types/task-edit-args.ts) and map in buildTaskUpdateInput (src/utils/task-edit-builder.ts) so core normalization/validation applies.
3. Surface type in outputs: Type line in formatTaskPlainText (shared by MCP task_view) next to Priority, and [type] indicator in formatTaskSummaryLine for task_list/task_search summaries.
4. Minimal tool description update in src/mcp/tools/tasks/index.ts (task_edit metadata list mentions type).
5. Tests in src/test/mcp-tasks.test.ts: create/edit with type incl. case-insensitive canonicalization, invalid type error surfaced through MCP, type in view/list output, untyped tasks show no type, schema exposes config-driven enum.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Schema approach: mirrored the status pattern (dynamic enum generated from config at tool registration) rather than priority's static enum, because allowed types are config-dependent. New generateTypeFieldSchema(config) in src/mcp/utils/schema-generators.ts builds enum from config.types (fallback DEFAULT_TASK_TYPES) with enumCaseInsensitive: true and no default (absent = untyped). Invalid types are rejected at the MCP boundary with the standard enum validation error listing valid values, exactly like status; core normalizeTaskType still guards the CLI path with 'Invalid type: ...'.

Edit path reuses the shared buildTaskUpdateInput (type added to TaskEditArgs), so CLI (BACK-355.02) gets the same mapping for free. Outputs: 'Type: <type>' line added to shared formatTaskPlainText (task_view, CLI --plain) next to Priority, and '[<type>]' indicator added to the MCP task list/search summary line next to '[PRIORITY]'. Untyped tasks render no type anywhere. Clearing a type via MCP is not supported (enum blocks empty string), same as status; clearing remains a CLI/core capability via empty string.

Validation: bunx tsc --noEmit clean; bunx biome check clean; bun test src/test/mcp-tasks.test.ts 23/23 pass; full bun test 1401 pass with only the documented pre-existing flakes (cli-priority-filtering timeout, server-search-endpoint milestone timeouts — both fail identically on clean origin/main).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added optional 'type' parameter to MCP task_create and task_edit. Schemas expose a config-driven enum (config.types, fallback bug/feature/enhancement/task/chore/docs/spike) with case-insensitive matching canonicalized to configured casing and no default, mirroring the existing dynamic status enum pattern. Type flows through createTaskFromInput and the shared buildTaskUpdateInput so core validation applies. task_view (shared plain-text formatter) now prints 'Type: <type>' next to Priority, and task_list/task_search summaries show '[<type>]' next to the priority indicator; untyped tasks show no type. task_edit tool description mentions type; the type field description lists valid values. Verified with 3 new integration tests in src/test/mcp-tasks.test.ts (create/edit incl. case-insensitivity, invalid-type errors on create and edit, view/list output, untyped rendering, config-driven enum with custom types) plus tsc, biome, and the full suite.
<!-- SECTION:FINAL_SUMMARY:END -->
