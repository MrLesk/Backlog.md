---
id: BACK-493.3
title: 'Web UI TaskCard: add Subtask badge for tasks with a parentTaskId'
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
modified_files:
  - src/web/components/TaskCard.tsx
parent_task_id: BACK-493
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Kanban task cards (`src/web/components/TaskCard.tsx`) have no visual indicator that a task is a subtask. After BACK-493.01 ships, the `task` object will include `parentTaskId` when the task belongs to a parent. This task adds a small "Subtask" badge to such cards.

**What to add in `TaskCard.tsx`:**

In the header row (the `div` that contains the task ID span and priority badge, around line 110–125 of the current file), add a "Subtask" badge when `task.parentTaskId` is set.

Badge design:
- Small pill, same size as the priority badge (`text-[10px] font-semibold rounded px-1.5 py-0.5`)
- Color: muted purple or indigo, e.g. `bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300`
- Label: "Subtask"
- Placed left of or adjacent to the task ID, or in the same header row as the priority badge

Optionally show the parent ID as a `title` tooltip on the badge: `title={\`Parent: \${task.parentTaskId}\`}`.

No prop changes needed — `task.parentTaskId` is already part of the `Task` type.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tasks with parentTaskId show a 'Subtask' badge on their kanban card
- [ ] #2 Tasks without parentTaskId show no 'Subtask' badge
- [ ] #3 Badge is visually distinct from the priority badge (different color)
- [ ] #4 Badge tooltip shows the parent task ID
- [ ] #5 No TypeScript errors, bun test passes, bun run check . passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
