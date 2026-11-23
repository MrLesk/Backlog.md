---
id: BACK-834.1
title: Read a workspace file and list its projects from the CLI
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - core
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1069
  - src/core/backlog.ts
parent_task_id: BACK-834
priority: medium
type: feature
ordinal: 431000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First step of the parent task. Before a browser can show several projects, Backlog needs one place that names them and a CLI command that reads it, because new capabilities start in the CLI and the shared model.

GitHub issue #1069 proposes an explicit file (`backlog-workspace.yml`) and read-only commands with one core per repository. The maintainer accepted a workspace file on 2026-10-11. This subtask adds the file and a read-only listing. It changes no project.

To settle with the maintainer at plan review: the file name and where it is looked for; the command name (issue #1069 uses `workspace`, and the top-level unit is called a Project); and whether projects are added by commands or by editing the file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A workspace file names projects by path, relative to the file or absolute, with an optional display name. It is human-readable and documented.
- [ ] #2 A read-only CLI command lists the projects of a workspace with name, path, task prefix and the number of tasks per status, in plain text and in versioned JSON.
- [ ] #3 Each project is read through its own core, so its configured statuses, prefixes and folders apply.
- [ ] #4 A listed path that is missing or is not a Backlog project is reported for that entry, and the other projects are still listed.
- [ ] #5 Two entries that resolve to the same project are reported instead of being listed twice.
- [ ] #6 The command changes nothing in any project and nothing in the workspace file.
- [ ] #7 CLI help and the shipped CLI instructions describe the file and the command.
- [ ] #8 Tests use temporary directories with two or more projects, including a missing path and two projects with the same task prefix.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
