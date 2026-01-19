---
id: BACK-367.02
title: MCP tools and schemas integration for Final Summary field
status: Done
assignee:
  - '@codex'
created_date: '2026-01-18 12:19'
updated_date: '2026-01-19 18:27'
labels:
  - mcp
  - enhancement
dependencies:
  - BACK-367
documentation:
  - src/mcp/utils/schema-generators.ts
  - src/guidelines/mcp/task-finalization.md
parent_task_id: BACK-367
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Scope

Integrate the `finalSummary` field into MCP tool schemas so AI agents can read and write the Final Summary via MCP.

**Depends on:** BACK-367 (core infrastructure must be complete first)

### MCP Schema Updates

**`task_create` tool:**
- Add `finalSummary` parameter (string, optional)
- Description: "Final summary for PR-style completion notes. Write this only when the task is complete."

**`task_edit` tool:**
- Add `finalSummary` parameter (string, optional) - set/replace operation
- Add `finalSummaryAppend` parameter (array of strings, optional) - append operation
- Add `finalSummaryClear` parameter (boolean, optional) - clear operation

**`task_view` response:**
- Ensure `finalSummary` is included in the task response when present

### Workflow Guide Updates

Update `src/guidelines/mcp/task-finalization.md`:
- Clarify that `implementationNotes` (via `notesAppend`) is for progress logging during work
- Add guidance that `finalSummary` is for the PR-style completion summary
- Update the finalization checklist to include writing the final summary as the last step before marking Done

### Reference Files

- `src/mcp/utils/schema-generators.ts` - Schema generation for task tools
- `src/mcp/tools/tasks/handlers.ts` - Task tool handlers
- `src/guidelines/mcp/task-finalization.md` - Finalization workflow guide
- `src/guidelines/mcp/task-execution.md` - Execution workflow guide (may need minor update)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP `task_create` schema includes `finalSummary` string parameter with clear description
- [x] #2 MCP `task_edit` schema includes `finalSummary` (set), `finalSummaryAppend` (append), `finalSummaryClear` (clear) parameters
- [x] #3 MCP `task_view` response includes finalSummary field when present
- [x] #4 Workflow guide `task-finalization.md` updated to distinguish implementationNotes (progress log) from finalSummary (PR description)
- [x] #5 Workflow guide includes finalSummary in the finalization checklist
- [x] #6 MCP tests in `src/test/mcp-final-summary.test.ts` cover create, edit operations, and view response
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Update MCP task schemas in `src/mcp/utils/schema-generators.ts` to include `finalSummary`, `finalSummaryAppend`, `finalSummaryClear` for create/edit.
- Wire handler inputs in `src/mcp/tools/tasks/handlers.ts` (and any task-edit builder) to pass final summary fields through.
- Ensure task view responses include `finalSummary` when present.
- Update MCP workflow guidance in `src/guidelines/mcp/task-finalization.md` (and any execution guide references) to distinguish notes vs final summary.
- Add MCP tests in `src/test/mcp-final-summary.test.ts` for create/edit/view flows.
- Run targeted tests: `bun test src/test/mcp-final-summary.test.ts`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: Added finalSummary fields to MCP task schemas and handlers, updated task finalization guidance, and ensured task_view output includes Final Summary.

Tests: bun test src/test/mcp-final-summary.test.ts
<!-- SECTION:NOTES:END -->
