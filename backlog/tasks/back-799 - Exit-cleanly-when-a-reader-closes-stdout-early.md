---
id: BACK-799
title: Exit cleanly when a reader closes stdout early
status: Done
assignee:
  - '@claude'
created_date: '2026-11-10T07:23:00Z'
updated_date: '2026-11-10T07:45:00Z'
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
- [x] #1 When the reader of stdout closes before the CLI has written all its output, the CLI prints no stack trace and no runtime error on stderr and exits with status 0. This holds for `backlog task view <id> --json | true`, `backlog task list --plain | head -1` and `backlog search <query> --plain | head -1`.
- [x] #2 A command that fails for its own reason still prints its message and exits non-zero, for example `backlog task view` with an ID that matches no task.
- [x] #3 A regression test runs the CLI with a reader that closes stdout early and checks stderr and the exit status.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root cause: a write to a pipe whose reader has gone emits an EPIPE 'error' event on process.stdout. Nothing listens, so the process crashes. neo-neo-bblessed (loaded with the TUI modules) replaces the global EventEmitter emit, which turns that crash into 'TypeError: Error is not a constructor'. Paths that write with console.log are already silent in Bun; process.stdout.write paths (JSON output, task list --plain) crash.
2. Add one process-wide stdout error listener at the CLI entry point (src/cli.ts, next to the other process setup). On EPIPE it ends the process with process.exit(), which keeps any exit status the command already recorded (0 when it succeeded). Any other stdout error is thrown as before, so failures such as a full disk still fail loudly.
3. Remove the MCP server's own stdout EPIPE listener, which the entry-point listener makes unreachable; keep its stderr listener. watchJson keeps its handling because it serves any Writable and has its own tested lifecycle.
4. Add a regression test to src/test/cli-pipe-output.test.ts (runs in the platform CI profile): spawn the CLI with a stdout reader that is closed before the CLI writes; assert exit 0 and empty stderr for task view --json, task list --plain and search --plain, and that a command that already failed (duplicate task ID warning) keeps its stderr and non-zero status. Show it failing before the fix.
5. Verify from source and with the compiled binary from bun run build in a scratch project; run check:types, check, and focused tests (pipe output, JSON watch, MCP stdio).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: process.stdout emitted an EPIPE 'error' event that nothing handled. neo-neo-bblessed replaces the global EventEmitter emit when the TUI modules load, so that crash showed as 'TypeError: Error is not a constructor'. Bun's console.log already ignores EPIPE, which is why search --plain did not crash; process.stdout.write paths (JSON output, task list --plain) did.

Fix: one stdout error listener in src/cli.ts next to the other process setup. On EPIPE it calls process.exit() without an argument, so the status a command already set is kept (0 for a successful command). Other stdout errors are rethrown, so for example EBADF still fails with the real error and status 1. The MCP server's own stdout EPIPE listener could no longer run and was removed; its stderr listener stays. watchJson keeps its stream handling because it serves any Writable and has its own tests.

Verification:
- Reproduced on main from source in a scratch project: task view 1 --json | true, task list --plain | true and task list --json | true gave rc=1 plus about 908 bytes of stack trace. search --plain | head -1 already gave rc=0.
- Regression test in src/test/cli-pipe-output.test.ts (platform CI profile). Before the fix, 3 of 4 failed: task view --json, task list --plain, and the already-failed duplicate-ID case. After the fix, all 6 tests in the file pass. Changing process.exit() to process.exit(0) makes the duplicate-ID case fail.
- From source and with the compiled dist/backlog from bun run build: task view 1 --json | true / | head -1, task list --plain | head -1 / | true and search Task --plain | head -1 give rc=0 and empty stderr. task view 999 --json | true gives rc=1 and the not-found message. With a complete reader, task view 1 --json output from the binary is byte-identical to the source output.
- The regression test also passes against the CI-style JS bundle (BACKLOG_BUILD_OUTDIR + BACKLOG_TEST_CLI_BUNDLE).
- bun run check:types and bun run check pass. Focused suites pass: cli-pipe-output, cli-json-watch, watch-json and mcp-stdio-exit (25 tests). The platform CI profile passes: 520 tests, 0 failures.

Observed, out of scope: task list --json --watch | head -1 keeps running until the next snapshot write. It behaves the same on main, because a watch only learns the reader has gone when it writes again.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A reader that closes stdout early, such as | head -1 or | true, now ends the CLI quietly. Before, the CLI exited 1 and printed a Bun stack trace. One process.stdout error listener in src/cli.ts handles EPIPE for every command. It keeps the exit status the command already set, so successful reads exit 0 and commands that already failed still exit non-zero with their message. Any other stdout error is still thrown. The MCP server's stdout EPIPE listener became unreachable and was removed. A regression test in cli-pipe-output.test.ts covers task view --json, task list --plain and search --plain with a closed reader, plus a command that had already failed. Verified from source, from the compiled binary and from the CI JS bundle. Types, Biome and the platform test profile pass.

Follow-up for review: neo-neo-bblessed globally replaces EventEmitter.prototype methods. That is why any unhandled 'error' event in the CLI shows as 'Error is not a constructor' instead of the real error.
<!-- SECTION:FINAL_SUMMARY:END -->
