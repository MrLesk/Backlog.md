---
id: BACK-755
title: Stop single-task commands from parsing every task file
status: To Do
assignee: []
created_date: '2026-10-11 20:02'
updated_date: '2026-10-11 20:36'
labels: []
dependencies:
  - BACK-754
  - BACK-719
references:
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/utils/task-path.ts
priority: medium
type: enhancement
ordinal: 373000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Commands that act on one task still load the whole backlog. Measured on version 1.53.0, `backlog task view BACK-5000 --plain` takes 2.2 s on a 10,000-task project, the same as listing every task, because resolving a single ID lists and parses every task file on the board and in finished-work storage. `backlog task edit` makes at least four such passes and `backlog task create` several more. Five separate code paths resolve a task by ID (`getTask`, `loadWorkingCopyTask`, `FileSystem.loadTask`, `getTaskPath` and a content-store fallback), each with its own rule for ambiguous IDs, so fixing the cost in one of them leaves the others slow and lets their behaviour drift apart. BACK-719 removes `backlog task complete` and changes these paths, so the list of code paths needs checking against the code as it stands after that change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Viewing, editing, archiving or demoting one task makes at most one pass over the task corpus per command, shown by a test.
- [ ] #2 On a generated project with 10,000 tasks, `backlog task view <id> --plain` is at least five times faster than before the change on the same machine. Before and after timings are recorded in the task.
- [ ] #3 Unknown IDs, ambiguous IDs and duplicate files fail closed with the same messages and exit codes as before on every touched command.
- [ ] #4 Checkout-only commands resolve a task ID through one shared code path.
- [ ] #5 Readiness, dependency graph and subtask output are unchanged across the existing tests.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
