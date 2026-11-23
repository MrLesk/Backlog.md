---
id: BACK-834
title: Handle several projects from one Backlog instance
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - web
  - core
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1069
  - src/server/index.ts
  - src/core/backlog.ts
priority: medium
type: feature
ordinal: 430000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People who use Backlog.md in several repositories run one browser per project, each on its own port, and doc-003 documents one service per project. Nothing shows what is in progress across them. GitHub issue #1069 asks for a workspace view.

Decisions already made by the maintainer:

- 2026-10-11: several ordinary single-project cores run inside one process, the projects are listed in a workspace file, and the cross-project level is read-only first.
- 2026-11-23: the goal is one Backlog instance that handles several Backlog projects. The top-level unit is called a Project. The Overview drawing, with one card per project showing what is in progress and what is next, plus a list of the proposed decisions and drafts that wait for a person, is approved as the direction.

Facts checked on 2026-11-23 against version 1.55.3:

- `Core` takes one project root, and two cores for different roots can live in one process. Watchers, caches, locks and git calls belong to the instance.
- The browser server holds one core, and starting it changes the process working directory once for bundled assets.
- No API route and no WebSocket message names a project. The web client uses a fixed `/api` base.
- Task IDs are unique only inside a project, and most projects use the default `task` prefix. Document and decision IDs (`doc-N`, `decision-N`) are the same in every project.
- There is no user-level configuration and no list of known projects anywhere (BACK-422).
- "project" already names the task attribute for monorepos (BACK-643). The maintainer chose Project for the top-level unit, so that attribute needs a different label wherever both appear. The label is not chosen yet.

This task holds the outcome. Its subtasks deliver it in order: the workspace file with a CLI listing, a browser server that serves several projects, and the project list with the Overview in the web UI. A list of all tasks across projects and changing the workspace from the browser are not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One backlog browser started for a workspace shows every listed project, and each project can be opened with its tasks, milestones, drafts, documents, decisions, statistics and settings behaving as in a single-project browser.
- [ ] #2 A project used without a workspace behaves exactly as it does today in the CLI, the TUI and the browser.
- [ ] #3 The cross-project level reads and links only. Every change is made inside one project through the core of that project.
- [ ] #4 Wherever records of two projects can meet, a record is identified by project and ID, and no read or change guesses the project.
- [ ] #5 The CLI can list the projects of a workspace, and CLI help and the shipped instructions describe the workspace file and the command.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
