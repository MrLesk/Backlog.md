---
id: BACK-720
title: Fail clearly when cleanup runs without an interactive terminal
status: To Do
assignee: []
created_date: '2026-10-11 10:42'
labels:
  - bug
dependencies:
  - BACK-719
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1060'
type: bug
ordinal: 338000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog cleanup` is prompt-only. When stdin is not a terminal, for example in a script or with input redirected from /dev/null, it still draws the age picker, exits 0, and moves nothing, so a caller cannot tell the no-op from a success (issue #1060, reproduced on 1.53.0).

A non-interactive age option such as `--older-than` is requested in the same issue and is not part of this task.

Depends on BACK-719: that task changes the storage behavior cleanup relies on, so this fix is made against the lifecycle it leaves in place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With stdin not a TTY (for example `backlog cleanup </dev/null`), the command exits non-zero.
- [ ] #2 In that case it prints a clear message saying that cleanup needs an interactive terminal, and draws no prompt.
- [ ] #3 In that case no task is moved or changed.
- [ ] #4 In an interactive terminal, cleanup prompts and behaves as it did before this change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
