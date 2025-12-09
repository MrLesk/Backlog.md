---
id: task-340
title: Add Gantt timeline & scheduling to Backlog.md
status: To Do
assignee: []
created_date: '2025-12-09 12:30'
updated_date: '2025-12-09 14:57'
planned_start: '2025-12-09'
planned_end: '2025-12-12'
labels:
  - web-ui
  - planning
  - gantt
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend Backlog.md with task date fields and a browser Gantt view for project planning, including work package timelines.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend core task model and parsing
   - Add optional `plannedStart` / `plannedEnd` (string, normalized date/datetime) to `Task`, `TaskCreateInput`, and `TaskUpdateInput` in `src/types/index.ts`.
   - Update `parseTask` in `src/markdown/parser.ts` to read `planned_start` / `planned_end` from frontmatter using `normalizeDate`, and ensure they round-trip via existing markdown write paths.
   - Decide and document accepted formats (prefer `YYYY-MM-DD` and `YYYY-MM-DD HH:mm`) and default timezone assumptions.
2. Wire dates through CLI / core / API
   - Ensure CLI create / edit flows accept and preserve `plannedStart` / `plannedEnd` (re-using existing metadata patterns where possible).
   - Update core `ContentStore` / `Core` task-loading so `Task` instances always include the new fields, and extend any task filtering or sorting that should consider planned dates (without breaking current behaviour).
   - Update `BacklogServer` handlers in `src/server/index.ts` to pass date fields through `/api/tasks`, `/api/task/:id`, and `/api/tasks/:id` payloads.
   - Extend `ApiClient` in `src/web/lib/api.ts` so `createTask` / `updateTask` can send and receive the new date fields.
3. Add scheduling fields to the web UI
   - Update `TaskDetailsModal` in `src/web/components/TaskDetailsModal.tsx` to display and edit `plannedStart` / `plannedEnd` (initially as simple text/date inputs aligned with existing metadata styling).
   - Surface planned dates in list/board views where helpful (e.g. small badges or tooltips in `TaskCard` / `TaskList`) without cluttering the UI.
4. Implement browser Gantt/timeline view
   - Add a new `GanttPage` React component under `src/web/components` and route it from `SideNavigation` / `App` (e.g. `/gantt`).
   - Implement basic timeline layout: horizontal time axis, one row per task (or per milestone / parent), and bars spanning `plannedStart` → `plannedEnd`; visually distinguish status and missing dates.
   - Use existing `apiClient.fetchTasks` (with optional filters by label/milestone) to populate the Gantt view; handle tasks lacking dates (hide, list separately, or show markers).
5. Documentation and examples
   - Update project docs / README and `backlog/tasks/readme.md` with the new frontmatter fields, formats, and a short “How to use the Gantt view” section.
   - Add at least one example task file using `planned_start` / `planned_end` for reference and manual testing.
6. Tests and validation
   - Extend markdown / parsing tests (e.g. `test/markdown.test.ts`, related helpers) to cover parsing and round-tripping of planned dates.
   - Add/extend web/API tests (e.g. `test/server-assets.test.ts`, `test/server-search-endpoint.test.ts`, and relevant web tests if present) to ensure date fields are included in responses.
   - Add or update CLI / core tests where appropriate (e.g. `test/core.test.ts`, `test/task-sorting.test.ts`) to validate date handling does not regress existing behaviour.
<!-- SECTION:PLAN:END -->
