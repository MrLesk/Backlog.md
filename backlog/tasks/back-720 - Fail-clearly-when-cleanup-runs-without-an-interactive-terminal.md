---
id: BACK-720
title: Fail clearly when cleanup runs without an interactive terminal
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:42'
updated_date: '2026-10-11 21:41'
labels:
  - bug
dependencies:
  - BACK-719
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1060'
  - commands
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/cli.ts
  - src/test/cli-cleanup-input.test.ts
  - src/test/append-implementation-plan.test.ts
  - src/test/test-utils.ts
type: bug
ordinal: 338000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog cleanup` is prompt-only. When stdin is not a terminal, for example in a script or with input redirected from /dev/null, it still draws the age picker, exits 0, and archives nothing, so a caller cannot tell the no-op from a success (issue #1060, reproduced on 1.53.0).

A non-interactive age option such as `--older-than` is requested in the same issue and is not part of this task.

Depends on BACK-719: since that task, cleanup archives finished tasks instead of moving them to completed storage, and this fix is made against that behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With stdin not a TTY (for example `backlog cleanup </dev/null`), the command exits non-zero.
- [x] #2 In that case it prints a clear message saying that cleanup needs an interactive terminal, and draws no prompt.
- [x] #3 In that case no task is moved or changed.
- [x] #4 In an interactive terminal, cleanup prompts and behaves as it did before this change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Layer 4 of the stack (branch tasks/back-720-cleanup-non-tty on top of BACK-731).

1. CLI (src/cli.ts): at the start of the `cleanup` action, before anything is read or drawn, stop when there is no interactive terminal. Reuse what BACK-698 did for `init`: the existing `hasInteractiveTTY` check (stdin and stdout are both terminals), a `clack.cancel` line with a clear message, and exit code 1. No prompt is drawn and no task is read or archived. The interactive path is not touched. No non-interactive age option is added.

2. Help and docs: the `cleanup` help says it needs an interactive terminal; CLI-INSTRUCTIONS marks the command as interactive.

3. Tests through the public CLI (src/test/cli-cleanup-input.test.ts, project outside the repository): with stdin closed and with answers piped into stdin the command exits 1, prints the message, draws no prompt and leaves the finished task on the board; with a terminal reported on both ends it still draws the age prompt and does not print the message.

4. Verification: scoped tests, `bunx tsc --noEmit`, `bun run check .`, `bun run test` once at the top of the stack, a scripted end-to-end run of every acceptance criterion against a binary built from this layer in a private mktemp project, and the interactive cleanup in a pseudo-terminal.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-720-cleanup-non-tty, stacked on BACK-731. The description was corrected through the CLI: cleanup archives since BACK-719, it no longer moves tasks to completed storage.

CLI: the `cleanup` action starts with the check `init` already uses since BACK-698: when `hasInteractiveTTY` is false (stdin and stdout are not both terminals) it prints one `clack.cancel` line, "Cleanup needs an interactive terminal to ask which tasks to archive. Run `backlog cleanup` in a terminal.", sets exit code 1 and returns before any task is read, any prompt is drawn or anything is archived. The interactive path is unchanged. No non-interactive age option was added. The `cleanup` help and CLI-INSTRUCTIONS say that the command needs an interactive terminal.

Tests: src/test/cli-cleanup-input.test.ts runs the CLI with stdin closed and with answers piped into stdin (exit 1, the message, no prompt, the finished task still on the board) and in a pseudo-terminal through `script`, the way src/test/append-implementation-plan.test.ts does, where the age question is still drawn and the message is absent. The project is created outside the repository.

Choices taken conservatively and listed for review: the check is the existing both-ends check, so `backlog cleanup` with a terminal on stdin and its output redirected also fails with the message instead of drawing prompts into a file; the message goes through `clack.cancel` to stdout, as the `init` failures do.

Verification: `bunx tsc --noEmit` clean; `bun run check .` clean; scoped tests pass. A scripted end-to-end run against a binary built from this layer showed `backlog cleanup </dev/null`, piped answers and captured output all exiting 1 with the message, no prompt and unchanged task files, and a pseudo-terminal run showed the interactive cleanup asking both questions, archiving on yes and leaving everything on no.

Review round: the message is now true in every combination, 'Cleanup needs an interactive terminal for both its input and its output, because it asks which tasks to archive. Nothing was archived.', and the help and CLI-INSTRUCTIONS say the same. The test that used to be titled 'stdin is closed' says that stdin is redirected from /dev/null. The pseudo-terminal helper moved into src/test/test-utils.ts (runCliInPseudoTerminal, with a sized terminal) and both this test and src/test/append-implementation-plan.test.ts use it.

Third review round: the pseudo-terminal test helper uses the suite's platform timeout instead of a fixed five seconds. Every acceptance criterion was re-run end to end against a binary built from this layer's tip: stdin from /dev/null, answers piped in and output captured all exit 1 with the message and change nothing, and a pseudo-terminal run asks both questions, archives on yes and leaves everything on no.

CI fix for the Linux runner: the pseudo-terminal case of src/test/cli-cleanup-input.test.ts timed out on ubuntu-latest (7.0 s, `timedOut` true). The macOS and Windows jobs did not run it: they run the platform profile of scripts/run-ci-tests.ts, a fixed list of files that contains neither this test nor src/test/append-implementation-plan.test.ts, so the Ubuntu job is the only one that runs the pseudo-terminal cases. On a Mac the test passed locally.

Cause: the test helper ran the CLI through the `script` utility with /dev/null as script's own input and counted on that to end cleanup's first question. Nothing ends a question in a terminal nobody types into; on macOS the run only ended by accident. When its input ends, `script` types one Ctrl-D into the terminal. On macOS the prompt, which reads the terminal in raw mode, receives that byte (4), and a Ctrl-D at the prompt makes the command exit 0. On Linux the Ctrl-D arrives while the terminal is still in line mode, where the kernel turns it into an end-of-file marker; once the prompt switches the terminal to raw mode that marker is delivered as a NUL byte (0), which the prompt ignores. Cleanup drew its question correctly and then waited until the helper's 5 s timeout stopped it; util-linux `script` sleeps 2 s before it kills its child, which is the 7.0 s in the log. Reproduced in an Ubuntu 24.04 container with the runner's versions (util-linux 2.39.3, Bun 1.3.14): the same assertion failed after 7,025 ms. Probes on both systems showed a raw-mode reader under `script` receiving byte 4 on macOS and byte 0 on Linux, and cleanup's prompt exiting on byte 4 and ignoring byte 0 on both.

Fix: `runCliInPseudoTerminal` in src/test/test-utils.ts uses Bun's own pseudo-terminal (the `terminal` option of `Bun.spawn`) instead of `script`, `stty` and a shell line, so macOS and Linux run the same code, and it takes an optional answer: keys to type once a given text has been drawn. The cleanup test types Escape once the age question has been drawn, so cleanup ends by itself through its own cancel path, and the test also asserts 'Cleanup cancelled.', exit code 0 and that nothing was archived. The timeout stays only as a guard for a command that hangs. src/test/append-implementation-plan.test.ts shares the helper and was not exposed to the problem: its command asks nothing and exits by itself (it passed on the same Linux run in 305 ms); it passes with the new helper.

Verification: both test files pass in the Ubuntu 24.04 container with Bun 1.3.14 (the pseudo-terminal case in about 240 ms) and on macOS with Bun 1.3.14 and 1.4.3; 60 runs of both files, six at a time, had no failure on either system, and ten runs with the Ubuntu job's flags (`--parallel=2 --isolate --timeout=10000 --max-concurrency=2`) had none in a Linux container. With the terminal check inverted, all three cleanup cases fail, the pseudo-terminal one at once and not by timeout. `bunx tsc --noEmit` and `bun run check .` are clean. Not verified: an x86-64 Linux machine (the container is arm64) and the GitHub runners themselves.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog cleanup` no longer pretends to succeed when nobody can answer its prompts. Without an interactive terminal it used to draw the age picker, exit 0 and archive nothing, so a script could not tell the no-op from a success (issue #1060).

What changed
- The `cleanup` action starts with the check `init` uses since BACK-698: unless its input and its output are both a terminal, it prints "Cleanup needs an interactive terminal for both its input and its output, because it asks which tasks to archive. Nothing was archived.", exits 1, and returns before any task is read, any prompt is drawn or anything is archived.
- In an interactive terminal cleanup prompts and archives exactly as before.
- The `cleanup` help and CLI-INSTRUCTIONS say that the command needs an interactive terminal. No non-interactive age option was added; that request from the same issue is not part of this task.

Verification
- `bunx tsc --noEmit` and `bun run check .` are clean; the scoped tests pass. src/test/cli-cleanup-input.test.ts runs the CLI with stdin redirected from /dev/null and with answers piped in (exit 1, the message, no prompt, the finished task still on the board) and in a pseudo-terminal, where the age question is still drawn.
- A scripted end-to-end run against a binary built from this layer showed the same, and a pseudo-terminal run showed the interactive cleanup asking both questions, archiving on yes and leaving everything in place on no.

Choices to confirm
- The check needs a terminal on both ends, like `init`. With a terminal on stdin and the output redirected, cleanup now fails with the message instead of drawing its prompts into a file.
- The message goes to stdout through the prompt library's cancel line, as the `init` failures do.
<!-- SECTION:FINAL_SUMMARY:END -->
