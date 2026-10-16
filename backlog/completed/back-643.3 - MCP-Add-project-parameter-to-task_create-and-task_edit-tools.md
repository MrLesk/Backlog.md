---
id: BACK-643.3
title: 'MCP: Add project parameter to task_create and task_edit tools'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 16:20'
updated_date: '2026-08-20 16:41'
labels: []
dependencies:
  - BACK-643.1
parent_task_id: BACK-643
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add generateProjectFieldSchema(config) to src/mcp/utils/schema-generators.ts next to generatePriorityFieldSchema, using enum + enumCaseInsensitive, and omit the field from the generated schema entirely when config.projects is empty so single-project repos never see it. Wire into task_create, task_edit, and the list/search filter schema. Thread project through src/mcp/tools/tasks/handlers.ts (arg types, create/edit pass-through, plain-text result line), src/mcp/tools/tasks/index.ts (tool descriptions), src/types/task-edit-args.ts, and src/utils/task-edit-builder.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task_create and task_edit MCP tools accept an optional project parameter, validated case-insensitively against configured projects via the existing enum validator in src/mcp/validation/validators.ts
- [x] #2 The project field is absent from generated tool schemas entirely when no projects are configured
- [x] #3 MCP result text includes the project value when set, matching the existing [HIGH]-style priority prefix convention
- [x] #4 Tests in src/test/mcp-tasks.test.ts cover create/edit with valid, invalid, and unconfigured project values
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/mcp/utils/schema-generators.ts: add generateProjectFieldSchema(config) mirroring generatePriorityFieldSchema, using enum + enumCaseInsensitive; return undefined/omit when config.projects is empty. Wire into task_create and task_edit schemas only (list/search filter schema deferred to BACK-643.4).
2. src/mcp/tools/tasks/handlers.ts: thread project through create/edit arg types and pass-through; add project to the [HIGH]-style result line.
3. src/mcp/tools/tasks/index.ts: update task_create/task_edit descriptions to mention project.
4. src/types/task-edit-args.ts and src/utils/task-edit-builder.ts already have project wired from BACK-643.2 (shared with CLI) -- verify only.
5. Write src/test/mcp-tasks.test.ts coverage for create/edit with valid/invalid/unconfigured project.
6. Run bunx tsc --noEmit, bun run check ., bun test mcp-tasks.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Corrected scope during execution: removed 'task_list MCP tool supports filtering by project' from this task's AC and moved it to BACK-643.4. Verified against the actual BACK-355 precedent (commit 86f8846 vs 7a94976): MCP list/search filtering for 'type' landed in the filtering slice (.04), not the mutation slice (.03). Project filtering should follow the same split.

Added generateProjectFieldSchema() to schema-generators.ts, wired into task_create/task_edit schemas only via a conditional spread (project property omitted entirely from the JSON schema object when config.projects is empty). Because both schemas set additionalProperties: false, passing project on an unconfigured repo is rejected by the existing generic validator with 'Unknown field project is not allowed' -- verified this is the actual behavior, not assumed. Added project to TaskCreateArgs, the create pass-through, and the [HIGH] [type]-style result-line indicator (formatTaskSummaryLine). task_edit needed no handler changes: TaskEditArgs.project and task-edit-builder.ts's mapping were already added in slice 2 (BACK-643.2) as shared CLI/MCP infrastructure -- confirmed by reading the code before assuming any gap. Updated task_edit's tool description to mention project.

Verification: bunx tsc --noEmit clean, bun run check . clean on all 22 touched files. New tests: 2 cases added to src/test/mcp-tasks.test.ts (schema omission + rejection when unconfigured; full create/edit/list/view/invalid-value flow when configured), following the existing task-type test pattern including proper McpServer re-registration and cleanup on config change. 36/36 mcp-tasks.test.ts tests pass (2 new), 41/41 combined with mcp-task-type-filtering.test.ts for regression.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the project attribute to the MCP task_create and task_edit tools: generateProjectFieldSchema() in schema-generators.ts (enum + case-insensitive, mirroring priority/type), wired conditionally so the property is entirely absent from both tool schemas when no projects are configured -- combined with additionalProperties: false, this makes passing 'project' on an unconfigured repo a clean validation error rather than a silent no-op. task_edit already worked via the shared TaskEditArgs/task-edit-builder.ts infrastructure from BACK-643.2. Added a [Project]-style indicator to MCP result/list text. Corrected task scope during execution: moved 'task_list project filtering' to BACK-643.4, matching the actual BACK-355 precedent where type's list/search filtering landed in the filtering slice, not the mutation slice. Verified with bunx tsc --noEmit, bun run check . (clean), and 2 new tests in mcp-tasks.test.ts (36/36 passing).
<!-- SECTION:FINAL_SUMMARY:END -->
