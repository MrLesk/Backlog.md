---
id: BACK-493.1
title: 'Web UI API: enrich task responses with subtaskSummaries and parentTaskTitle'
status: To Do
assignee: []
created_date: '2026-05-13 10:50'
labels:
  - web-ui
  - subtasks
  - api
dependencies: []
references:
  - src/utils/task-subtasks.ts
  - src/core/backlog.ts
modified_files:
  - src/server/index.ts
parent_task_id: BACK-493
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web server returns raw task objects that lack computed subtask relationships. `handleListTasks` and `handleGetTask` in `src/server/index.ts` both return tasks without calling `attachSubtaskSummaries`, so `subtaskSummaries`, `subtasks`, and `parentTaskTitle` are always absent from API responses.

The utility `attachSubtaskSummaries(task, allTasks)` in `src/utils/task-subtasks.ts` computes these fields. It takes a single task and the full task list (needed to walk parent→child relationships). It is already used by the TUI (`src/ui/task-viewer-with-search.ts:268`) and by `Core.getTaskWithSubtasks` (`src/core/backlog.ts:432`).

**What to change:**

`handleListTasks` (`src/server/index.ts`, lines 632–684):
- After `const tasks = await this.core.queryTasks(...)`, fetch the full task list from the content store: `const store = await this.getContentStoreInstance(); const allTasks = store.getTasks();`
- Map the filtered result through `attachSubtaskSummaries`: `return Response.json(tasks.map(t => attachSubtaskSummaries(t, allTasks)))`
- Import `attachSubtaskSummaries` from `"../utils/task-subtasks.ts"` at the top of the file (check if already imported)

`handleGetTask` (`src/server/index.ts`, lines 855–870):
- After loading the task (`localTask` or the store lookup), fetch all tasks and enrich before returning: `const allTasks = store.getTasks(); return Response.json(attachSubtaskSummaries(task, allTasks))`

**Important constraint:** `queryTasks` returns only the filtered subset. `attachSubtaskSummaries` must receive the *full* unfiltered task list as its second argument so that parent→child links aren't broken by active filters. Use `store.getTasks()` (not the filtered result) as the second argument.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /tasks response includes subtaskSummaries array for parent tasks (non-empty when subtasks exist)
- [ ] #2 GET /tasks response includes parentTaskId and parentTaskTitle for subtask tasks
- [ ] #3 GET /tasks/:id response is also enriched for both parent and subtask tasks
- [ ] #4 Enrichment uses the full unfiltered task list, not the filtered query result
- [ ] #5 No TypeScript errors (bunx tsc --noEmit passes)
- [ ] #6 bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
