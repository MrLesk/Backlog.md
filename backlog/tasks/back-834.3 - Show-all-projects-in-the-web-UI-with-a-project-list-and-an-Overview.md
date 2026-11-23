---
id: BACK-834.3
title: Show all projects in the web UI with a project list and an Overview
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - web
dependencies:
  - BACK-834.2
  - BACK-828
references:
  - src/web/components/SideNavigation.tsx
  - src/web/App.tsx
parent_task_id: BACK-834
priority: medium
type: feature
ordinal: 433000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Third step of the parent task. With a server that serves several projects, the web UI needs a way to move between them and one place that shows what is happening in all of them.

The drawing approved by the maintainer on 2026-11-23 lists the projects in the sidebar, each with a color mark and its number of open tasks, and opens the pages of the chosen project under it. The Overview shows a list called Waiting for you with the proposed decisions and the drafts of every project, and one card per project with its name, task prefix, path, branch, tasks per status, the tasks in progress and the next tasks of the first status in their manual order. Every item opens inside its project.

The Overview reads and links only. The drawing also shows an Add project button. Changing the workspace from the browser is not decided and is not part of this subtask.

To settle with the maintainer at plan review: the label for the monorepo project attribute (BACK-643) where it appears beside a Project, and where the color of a project comes from.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With a workspace, the sidebar lists its projects with a color mark and the number of open tasks, and choosing one shows the pages of that project (Tasks, Milestones, Drafts, Docs, Decisions, Statistics, Settings) under it.
- [ ] #2 The address shows which project a page belongs to, and reloading or sharing it opens the same project and page.
- [ ] #3 The Overview shows one card per project with name, task prefix, path, current branch, the number of tasks per status, the tasks in progress and the next tasks of the first status in manual order.
- [ ] #4 The Overview lists the proposed decisions and the drafts of every project under Waiting for you, each with its project.
- [ ] #5 Every task, decision and draft on the Overview opens inside its own project, and the Overview itself changes nothing.
- [ ] #6 A task ID, document ID or decision ID is shown together with its project wherever items of several projects appear in one list.
- [ ] #7 A project that cannot be read is shown with the reason on its card and does not hide the others.
- [ ] #8 Without a workspace, the sidebar and the start page are the same as in a single-project browser.
- [ ] #9 The monorepo project attribute is labeled so that it cannot be mistaken for a Project.
- [ ] #10 The Overview and the project list are checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone, and tests cover a workspace of two projects and the single-project case.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
