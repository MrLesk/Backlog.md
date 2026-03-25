---
id: BACK-376
title: Fix web task creation dropping selected milestone
status: Done
assignee:
  - '@codex'
created_date: '2026-02-08 23:41'
updated_date: '2026-02-08 23:42'
labels:
  - bug
  - web
  - api
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/506'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate and fix issue where creating a task from the web UI with a selected milestone results in the task being created without milestone assignment (appears under Unassigned). Ensure server task-creation path preserves milestone and add regression test coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Creating a task via web API with a milestone persists that milestone on the created task.
- [x] #2 A regression test covers the server create-task flow with milestone input.
- [x] #3 Existing create/edit task behavior remains unchanged for requests without milestone.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: server `POST /api/tasks` did not forward `milestone` into `createTaskFromInput`, while update flow did. Added milestone mapping in `handleCreateTask` with string guard and added regression coverage in server API tests to verify milestone is preserved on create and retrievable via `/api/task/:id`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web task creation now preserves selected milestone by forwarding `milestone` in server create-task payload mapping. Added regression test `persists milestone when creating tasks via POST` in `src/test/server-search-endpoint.test.ts` to prevent recurrence.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
