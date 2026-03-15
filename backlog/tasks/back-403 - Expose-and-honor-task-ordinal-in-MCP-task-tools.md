---
id: BACK-403
title: Expose and honor task ordinal in MCP task tools
status: Done
assignee:
  - codex
created_date: '2026-03-15 12:57'
updated_date: '2026-03-15 13:18'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/562'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the existing task ordering field to MCP clients so agents can manage fine-grained backlog order using the current task_create and task_edit tools. Reuse the existing persisted ordinal model that already powers task ordering in the web/UI layers, and update MCP read paths so clients can observe both the stored ordinal and list ordering derived from it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task_create accepts an optional non-negative numeric ordinal field and persists it to the created task.
- [x] #2 task_edit accepts an optional non-negative numeric ordinal field and updates the stored task value.
- [x] #3 task_list orders tasks within each status bucket using existing ordinal-aware sorting so tasks with ordinal appear in ordinal order.
- [x] #4 task_view output includes the task's ordinal when present.
- [x] #5 MCP validation rejects invalid ordinal input consistently with existing task validation behavior.
- [x] #6 No new MCP tools are added; ordering support is delivered through the existing task tools.
- [x] #7 Automated tests cover schema exposure, create/edit persistence, list ordering, validation failure, and view output.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend MCP task_create and task_edit input schemas to expose a numeric ordinal field without adding any new tools.
2. Thread ordinal through MCP task_create handler args into the existing core task creation path, and reuse the existing task_edit update path.
3. Update task creation types/core persistence so ordinal is saved in task frontmatter on create, matching existing edit support.
4. Change MCP task_list sorting to use the existing ordinal-aware sorting within each status bucket while leaving status group ordering unchanged.
5. Update plain-text task formatting so task_view and task create/edit responses render Ordinal when present.
6. Add targeted MCP tests for schema exposure, create/edit persistence, list ordering, validation failure, and task_view output.
7. Run scoped tests, typecheck, and formatter/lint checks relevant to the touched TypeScript files, then update acceptance criteria, notes, final summary, and mark the task Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented ordinal support on the MCP task create path by extending the schema, handler args, and core TaskCreateInput persistence.

Updated MCP task_list ordering to use the existing ordinal-plus-priority sorter within each status bucket, including the Draft listing path, so manual ordering is respected without adding new tools.

Updated plain-text task formatting so task_view and create/edit responses render Ordinal when present.

Created and continued the work on branch tasks/back-403-ordinal-mcp after the user requested branch isolation.

Verification: bun test src/test/mcp-tasks.test.ts, bunx tsc --noEmit, and bun run check on the touched files all passed.

Addressed PR feedback: task_create now rejects explicit null ordinal values instead of persisting them and having them parse back as 0 on read. Re-verified with bun test src/test/mcp-tasks.test.ts, bunx tsc --noEmit, and bun run check on the touched files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Exposed the existing task ordinal field through MCP task_create and task_edit without introducing any new tools. The create path now persists ordinal values, MCP task schemas advertise the field with non-negative numeric validation, task_list now respects manual ordering by using the existing ordinal-aware sorting within each status bucket, and task_view/create/edit plain-text output now shows Ordinal when present. Added targeted MCP tests covering schema exposure, create/edit persistence, task_list ordering, validation failures, and task_view output. Verified with bun test src/test/mcp-tasks.test.ts, bunx tsc --noEmit, and bun run check on the touched files.

Follow-up: rejected explicit null ordinal values on the MCP create path and in core task creation so null cannot be persisted and later parse back to ordinal 0.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
