---
id: BACK-799
title: Exit cleanly when a reader closes stdout early
status: To Do
assignee: []
created_date: '2026-11-10T07:23:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1185'
priority: high
type: bug
ordinal: 405000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Piping Backlog output into a reader that stops early is ordinary shell use: `backlog task view <id> --json | head -1` is how people and agents peek at a large payload. Today the CLI treats the closed pipe as a crash. `backlog task view 1 --json | true` exits 1 and prints a Bun stack trace (`TypeError: Error is not a constructor`) on stderr. The dump floods logs and agent transcripts and hides the real exit status. Reported in issue #1185 against the 1.55.3 Linux release binary and reproduced from source on main at e1a67143 on macOS, where the same command wrote 802 bytes of stack trace. The closed-stderr hang from issue #1048 is a different failure and no longer reproduces on 1.55.3; it is not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When the reader of stdout closes before the CLI has written all its output, the CLI prints no stack trace and no runtime error on stderr and exits with status 0. This holds for `backlog task view <id> --json | true`, `backlog task list --plain | head -1` and `backlog search <query> --plain | head -1`.
- [ ] #2 A command that fails for its own reason still prints its message and exits non-zero, for example `backlog task view` with an ID that matches no task.
- [ ] #3 A regression test runs the CLI with a reader that closes stdout early and checks stderr and the exit status.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
