---
id: BACK-634
title: Fix web UI draft editing
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-15 13:17'
updated_date: '2026-08-15 13:39'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/915'
priority: high
type: bug
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #915: creating a draft and then editing it from the web Drafts page fails with "Task not found: DRAFT-2"; the underlying PUT /api/tasks/DRAFT-2 returns HTTP 400 and GET returns 404. The web Drafts page has offered a click-to-edit affordance since the drafts UI shipped, but the browser API only ever resolved tasks: handleGetTask and handleUpdateTask go through the task-only content store, which never contains drafts. This is pre-existing, not a v1.50.x regression. The shared core model already implements draft editing (Core.editTaskOrDraft / updateDraftFromInput) and MCP task tools already use it, so the browser server is the only surface with a draft edit UI and no draft handling behind it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Saving an edit to a draft from the web Drafts page writes to the draft file instead of failing with "Task not found"
- [x] #2 GET /api/tasks/<draft id> returns the draft instead of 404 so the browser resolves drafts and tasks through one path
- [x] #3 Changing a draft status to a configured non-draft status through the browser API promotes the draft, matching MCP semantics
- [x] #4 The web Drafts list reflects a saved draft edit without a manual page reload
- [x] #5 Regression tests cover the reporter's flow (create draft, then PUT /api/tasks/DRAFT-2) and the promote-on-status-change path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root cause confirmed: src/server/index.ts handleGetTask (line 934) and handleUpdateTask (line 1065) resolve only tasks through the content store, so a DRAFT id 404s on GET and 400s on PUT with 'Task not found: DRAFT-2' thrown by Core.updateTaskFromInput (src/core/backlog.ts:2337).
2. Simplify Core.editTaskOrDraft so the non-draft branch delegates straight to updateTaskFromInput instead of pre-loading with fs.loadTask and duplicating the demote branch. This keeps ambiguous-id detection and the task lock on the task path and removes duplicated logic.
3. Point the browser PUT /api/tasks/:id at Core.editTaskOrDraft so drafts are edited, promoted on a non-draft status, and tasks keep today's behavior.
4. Make handleGetTask fall back to the draft store when the id is not a task, matching MCP viewTask.
5. Refresh the web Drafts list on every data refresh by dispatching the existing drafts-updated event from App.refreshData, and drop the now redundant conditional dispatch in handleSubmitTask.
6. Add regression tests for the reporter's flow (create draft then PUT /api/tasks/DRAFT-2), the GET fallback, and promote-on-status-change.
7. Gates: bunx tsc --noEmit, bun run check ., bun run test, bun run build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: the browser task routes only ever resolved tasks. src/server/index.ts handleGetTask went straight to Core.getTask (task content store) and handleUpdateTask to Core.updateTaskFromInput, whose loadTaskForMutation resolves against the same task-only store, so DRAFT-2 fell through to the throw at src/core/backlog.ts:2337 ("Task not found: DRAFT-2") and the handler mapped it to HTTP 400. GET returned 404 for the same reason.

Not a v1.50.x regression. git log -S"loadDraft" -- src/server/index.ts has no hits in the whole history, and the same repro reproduces byte-identically on published v1.49.3 and v1.50.0 (GET 404, PUT 400 "Task not found: DRAFT-2"). The web Drafts page has offered click-to-edit since the drafts UI landed in #225, and saving never worked. backlog task edit DRAFT-2 also fails on 1.49.3, 1.50.0 and 1.50.1, so the canonical CLI never edited drafts either; only the not-found wording changed in 1.50.1.

Changes:
- Core.editTaskOrDraft now delegates its non-draft branch to updateTaskFromInput instead of pre-loading with fs.loadTask and repeating the demote branch. updateTaskFromInput already demotes on a Draft status, resolves through the mutation index (identical record set to fs.loadTask: working-copy active tasks) and raises AmbiguousTaskIdError, so this removes duplicated logic without changing MCP behavior. It also takes TaskReadOptions so callers can pass read options through.
- The browser PUT /api/tasks/:id routes DRAFT- ids to editTaskOrDraft and GET /api/tasks/:id serves them from the draft store. Draft ids are recognised by prefix (isDraftId), not by probing the draft store first, so a prefix-less id such as /api/tasks/2 keeps resolving to TASK-2 exactly as before instead of silently retargeting DRAFT-2.
- App.refreshData dispatches the existing drafts-updated event, so the Drafts page reloads after any save; the conditional dispatch in handleSubmitTask became redundant and was removed.
- The popup status field lists the status the record actually holds when it is not configured, so a draft reads Draft instead of falling back to the first option. The field is disabled for a draft: promoting changes the ID, and the Drafts page Promote action is the surface that reports the new one.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the browser serve drafts on the task routes it already pointed the Drafts page at. GET /api/tasks/DRAFT-x now returns the draft and PUT routes it through Core.editTaskOrDraft, so a draft edit saves (and a non-draft status promotes) instead of failing with HTTP 400 "Task not found: DRAFT-2". Draft ids are matched by prefix so /api/tasks/2 still resolves to TASK-2. Core.editTaskOrDraft lost its duplicated task branch to updateTaskFromInput, the Drafts page now reloads on the shared drafts-updated event after any save, and the popup status field shows a draft as Draft (disabled, because the Drafts page Promote action owns the ID change). Verified with new tests in server-drafts-endpoint (2 of 4 confirmed failing before the fix) and web-draft-editing (1 of 4 confirmed failing before the fix), plus a live browser walkthrough of the reporter flow: created a draft, edited title and acceptance criteria on the Drafts page, saw the draft file rewritten with status Draft, saw the list refresh without reload, and confirmed Promote to Task still works. Regression evidence recorded against published v1.49.3 and v1.50.0. bunx tsc --noEmit, bun run check ., bun run test (2253 pass, 6 skip, 0 fail) and bun run build all clean.
<!-- SECTION:FINAL_SUMMARY:END -->
