---
id: BACK-373
title: Support Drafts via MCP task tools (no new tools)
status: Done
assignee:
  - '@codex'
created_date: '2026-01-22 20:32'
updated_date: '2026-01-22 21:25'
labels:
  - mcp
  - drafts
dependencies: []
references:
  - src/mcp/tools/tasks/index.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/utils/schema-generators.ts
  - src/core/backlog.ts
  - src/mcp/README.md
  - src/guidelines/mcp/overview.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend existing MCP task tools to support draft creation, edits, transitions, listing, viewing, searching, and archiving without introducing new MCP tools. Drafts should be treated as tasks in a special folder, using status "Draft" as the trigger. MCP should prepend Draft to status enums even when config does not include it, and task_edit should handle promote/demote when status switches between Draft and non-Draft. Update MCP workflow guidance to mention draft support and filters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task_create accepts status "Draft" regardless of config statuses and creates a draft (DRAFT-X id) stored in drafts.
- [x] #2 task_edit supports editing drafts and handles Draft↔non-Draft transitions: Draft->Task promotes to new TASK-X id; Task->Draft demotes to new DRAFT-X id; returned response reflects new id and updated data.
- [x] #3 task_view returns details for drafts when given a draft id.
- [x] #4 task_archive archives drafts via archiveDraft and tasks via archiveTask, based on the resolved entity.
- [x] #5 task_list and task_search include drafts only when Draft status is explicitly requested; otherwise drafts remain excluded.
- [x] #6 MCP workflow docs mention Draft status support and how to access drafts via task tools.
- [x] #7 Tests cover MCP draft create/edit/promote/demote/view/list/search/archive behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Core: add draft-aware edit path in `src/core/backlog.ts` (new edit helper + updateDraft/updateDraftFromInput, plus ID-returning promote/demote helpers).
2) MCP task tools: update task_edit to use draft-aware helper; make task_view/task_archive draft-aware; include drafts in task_list/task_search only when status is Draft.
3) Schemas: prepend Draft into task_create/task_edit status enums (no config required).
4) Docs: update MCP workflow overview + tools overview to mention Draft status and filtering.
5) Tests: add MCP draft coverage for create/edit promote/demote/view/list/search/archive.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ran `bun run check .` but it fails due to existing formatting issues in unrelated files (e.g., src/cli.ts, src/file-system/operations.ts).

Ran `bunx biome check . --write` to fix formatting in unrelated files; `bun run check .` now passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented draft-aware MCP task handling so Draft status is accepted in schemas, task tools can create/edit/promote/demote drafts, and task_view/task_archive/list/search behave correctly when Draft is requested. Added core draft update/transition helpers and MCP draft tests, plus updated MCP workflow docs to explain Draft usage in the task-creation guide.

Tests: bunx tsc --noEmit; bun run check .; bun test src/test/mcp-*.test.ts
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
