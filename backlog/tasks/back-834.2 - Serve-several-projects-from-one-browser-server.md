---
id: BACK-834.2
title: Serve several projects from one browser server
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - web
  - core
dependencies:
  - BACK-834.1
references:
  - src/server/index.ts
  - src/web/lib/api.ts
parent_task_id: BACK-834
priority: medium
type: feature
ordinal: 432000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Second step of the parent task. The browser server holds one core today. No API route and no WebSocket message says which project it is about, the web client uses a fixed `/api` base, and starting the server changes the process working directory once for bundled assets.

To show several projects from one port, every request and every live update has to name its project, and a change has to reach the core of the project that owns the record. Document and decision IDs are the same in every project and many projects share the task prefix, so the project can never be worked out from an ID.

This subtask changes the server and the plumbing of the web client. The pages a person sees stay the same. The project list and the Overview come in the next subtask.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The backlog browser command started for a workspace serves every listed project from one port, with one core per project.
- [ ] #2 Every API route and every WebSocket message that refers to project data names its project.
- [ ] #3 A request that names a project that is not in the workspace, or names none where one is required, fails with a clear error and changes nothing.
- [ ] #4 A change is applied by the core of the project that owns the record, and a change in one project never touches the files of another.
- [ ] #5 A file change in one project updates the pages that show that project and does not refresh pages that show another.
- [ ] #6 The backlog browser command started in a project without a workspace keeps its current addresses and behavior, so existing links and bookmarks work.
- [ ] #7 The browser request validation from BACK-806 applies to every route, and the settings of one project cannot be changed through another.
- [ ] #8 Tests start one server over two projects that share a task prefix and cover reads, a change, a live update and an unknown project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
