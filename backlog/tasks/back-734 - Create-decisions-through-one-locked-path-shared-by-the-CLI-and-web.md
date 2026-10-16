---
id: BACK-734
title: Create decisions through one locked path shared by the CLI and web
status: To Do
assignee: []
created_date: '2026-10-11 19:08'
labels:
  - bug
dependencies:
  - BACK-732
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: bug
ordinal: 352000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision creation is the only create that takes no lock, and the CLI and the web UI each build the new decision on their own. Reproduced on main at 380b8f83: 12 `backlog decision create` commands started in parallel each printed "Created decision decision-N" and exited 0, but across nine runs only 6 to 9 files were left. Some runs ended with two files sharing an ID, others with decisions lost without a trace, and `backlog doctor` reported nothing for the lost ones. The same test with `backlog task create` and with `backlog doc create` gave 12 files with 12 distinct IDs, because both pick the ID and write the file inside the shared create lock.

The two entry points also disagree about what a new decision contains. `backlog decision create` writes empty Context, Decision and Consequences sections and honors `-s`. Creating a decision in the web UI writes placeholder text such as "[Describe the context and problem that needs to be addressed]" into each section and always uses the status proposed.

The maintainer's ruling on issue #1065 is that documents and decisions follow the task model: every interface calls the same core function and adds no logic of its own. For decisions that means one create function that picks the ID and writes the file under the create lock, used by the CLI and the web UI alike. The CLI is the canonical surface, so the file it writes today is the reference for what a new decision contains.

Depends on BACK-732, which stops a create from deleting another record's file. With that in place a collision leaves a visible duplicate where it used to lose a decision; this task removes the collision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 12 `backlog decision create` commands started in parallel leave 12 decision files with 12 distinct IDs, and each command prints the ID of a file that exists afterwards.
- [ ] #2 After that run `backlog decision list` shows 12 decisions and `backlog doctor` reports no duplicate decision IDs.
- [ ] #3 A `backlog decision create` that cannot obtain the create lock fails the way `backlog task create` does in that situation: it exits non-zero with a message and writes no file.
- [ ] #4 A decision created through the web UI (`POST /api/decisions`) and one created with `backlog decision create` using the same title produce files with identical content apart from the ID and the date; neither contains placeholder text.
- [ ] #5 `backlog decision create` keeps its current options and output, including `-s` and the default status proposed.
- [ ] #6 Tests cover parallel decision creates and the CLI and web results being identical.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
