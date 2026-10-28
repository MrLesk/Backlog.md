---
id: BACK-734
title: Create decisions through one locked path shared by the CLI and web
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 19:08'
updated_date: '2026-10-28T21:41:00Z'
labels:
  - bug
dependencies:
  - BACK-732
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
  - src/core/backlog.ts
  - src/cli.ts
  - src/server/index.ts
modified_files:
  - src/cli.ts
  - src/core/backlog.ts
  - src/server/index.ts
  - src/test/cli-decision-archive.test.ts
  - src/test/cli-timestamps.test.ts
  - src/test/commit-failure-after-change.test.ts
  - src/test/decision-archive.test.ts
  - src/test/server-content-record-archive.test.ts
  - src/test/server-decision-archive.test.ts
  - src/types/index.ts
  - src/test/decision-create.test.ts
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
- [x] #1 12 `backlog decision create` commands started in parallel leave 12 decision files with 12 distinct IDs, and each command prints the ID of a file that exists afterwards.
- [x] #2 After that run `backlog decision list` shows 12 decisions and `backlog doctor` reports no duplicate decision IDs.
- [x] #3 A `backlog decision create` that cannot obtain the create lock fails the way `backlog task create` does in that situation: it exits non-zero with a message and writes no file.
- [x] #4 A decision created through the web UI (`POST /api/decisions`) and one created with `backlog decision create` using the same title produce files with identical content apart from the ID and the date; neither contains placeholder text.
- [x] #5 `backlog decision create` keeps its current options and output, including `-s` and the default status proposed.
- [x] #6 Tests cover parallel decision creates and the CLI and web results being identical.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved by Alex on 2026-10-28. Reproduce parallel creation and CLI/HTTP differences. Add one Core.createDecisionFromInput path that allocates and writes under the existing create lock, with canonical CLI defaults and no placeholder text. Route CLI and HTTP creation through it. Verify 12 concurrent CLI writers, create-lock contention, CLI/HTTP equivalence, existing decision behavior, types, and Biome. Record results, review the change, create its task PR linked to #1065, address relevant Codex comments, and merge after checks. Follow with BACK-736, BACK-737, BACK-738, and BACK-739 as separate reviewable steps.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regression evidence: all three new tests failed before the fix (12 creates produced only 2 distinct IDs; HTTP added placeholders; CLI ignored a held create lock). After the fix, all three pass, including the public 30-second lock timeout. Existing CLI, timestamps, archive, HTTP, and commit-failure coverage passes: 110 tests across 8 files. One dependency-load failure during setup was resolved by installing pinned worktree dependencies; its 17-test file then passed. Bun 1.4.4 check:types and Biome 2.6.2 check pass. The old DoD tsc command is superseded by package.json and AGENTS.md: bun run check:types. Own specification and simplicity review found no supported blocker.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision creation now allocates and writes under the same create lock for CLI and HTTP. Both use the canonical empty sections; CLI status options and output stay unchanged. Twelve concurrent commands retain twelve distinct decisions, and a held create lock refuses creation without writing. Verified the regression tests, existing decision paths, types, and Biome. This is the first step of the approved #1065 work; update locking and content preservation follow.
<!-- SECTION:FINAL_SUMMARY:END -->
