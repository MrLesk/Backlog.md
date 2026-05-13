---
id: BACK-493.2
title: 'Web UI TaskDetailsModal: show parent task link and subtask list'
status: To Do
assignee: []
created_date: '2026-05-13 10:50'
labels:
  - web-ui
  - subtasks
  - frontend
dependencies:
  - BACK-493.1
references:
  - src/types/index.ts
  - src/utils/task-subtasks.ts
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
parent_task_id: BACK-493
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `TaskDetailsModal` (`src/web/components/TaskDetailsModal.tsx`) shows task details but renders no information about parent/child relationships. After BACK-493.01 ships, task objects from the API will include `parentTaskId`, `parentTaskTitle`, and `subtaskSummaries`. This task adds two new sections to the modal.

**What to add:**

1. **Parent task section** (shown only when `task.parentTaskId` is set):
   - Render below the task title / above the description area
   - Label: "Parent task"
   - Content: a badge or pill showing `task.parentTaskTitle ?? task.parentTaskId`
   - Clicking the badge should call `onOpenTask(task.parentTaskId)` — see below
   - Style: similar to the existing "From branch" amber banner, but subtler (e.g. a small row with an up-arrow icon and the parent ID/title)

2. **Subtasks section** (shown only when `task.subtaskSummaries` is non-empty):
   - Render at the bottom of the read area (after description, before acceptance criteria, or as a separate section using the existing `SectionHeader` component)
   - Label: "Subtasks"
   - Content: a list of `{ id, title }` entries from `task.subtaskSummaries`
   - Each entry is clickable (calls `onOpenTask(subtask.id)`) and shows `id — title`
   - Style: similar to the Dependencies section if one exists, or a simple list

3. **`onOpenTask` prop**:
   - Add `onOpenTask?: (taskId: string) => void` to the `Props` interface
   - When called, the modal should close itself (`onClose()`) and then invoke `onOpenTask(id)` so the caller can open the referenced task
   - Callers that don't support navigation can omit the prop; clicking should be silently no-op or hide the click affordance

**Wire-up in the app root:**
Find where `TaskDetailsModal` is rendered (likely `src/web/App.tsx` or similar) and pass `onOpenTask={(id) => { /* find task by id, set as selected */ }}`. The existing task list is already available in the app state.

**Do not** add new API calls inside the modal — the enriched data comes from the task object itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening a parent task in the modal shows a 'Subtasks' section listing all subtasks by ID and title
- [ ] #2 Opening a subtask in the modal shows a 'Parent task' section with the parent ID and title
- [ ] #3 Clicking a subtask entry closes the current modal and opens the subtask's detail modal
- [ ] #4 Clicking the parent task entry closes the current modal and opens the parent's detail modal
- [ ] #5 When subtaskSummaries is empty or absent, the Subtasks section is not rendered
- [ ] #6 When parentTaskId is absent, the Parent task section is not rendered
- [ ] #7 No TypeScript errors, bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
