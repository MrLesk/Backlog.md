---
id: BACK-688
title: Stop task list watchers when the process that started them exits
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 19:31'
updated_date: '2026-09-23 21:34'
labels: []
dependencies: []
references:
  - scripts/cli.cjs
  - src/commands/watch-json.ts
  - 'https://github.com/oven-sh/bun/blob/bun-v1.4.1/docs/runtime/bunfig.mdx'
modified_files:
  - src/test/cli-json-watch.test.ts
  - src/commands/watch-json.ts
  - scripts/cli.cjs
  - src/cli.ts
  - src/guidelines/cli-instructions/overview.md
  - CLI-INSTRUCTIONS.md
  - src/test/test-utils.ts
  - src/test/cli-launcher.test.ts
type: bug
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task list --json --watch` (added in BACK-686) is run by other programs that read its stdout. When such a program ends without stopping the watch, because its terminal is closed or it is killed, the watcher keeps running with parent PID 1. On 2026-09-23 six such watchers were found on one Mac, the oldest over two hours old. An orphaned watcher exits only when a task change makes it write to its closed stdout, so in a quiet repository it runs indefinitely.

The program that starts the watch cannot prevent this alone: a killed process cannot stop its children, and on npm installs the process it starts is the Node launcher `scripts/cli.cjs`. The launcher spawns the native binary with inherited stdio, forwards no signals, and does not notice when its own parent dies. A caller may start the watch in its own process group and stop it by signalling that group.

Verified on macOS on 2026-09-23: the compiled binary supports Bun no-orphans (`BUN_FEATURE_FLAG_NO_ORPHANS=1`, the `--no-orphans` flag, or `[run] noOrphans` in bunfig.toml). With that variable in its environment, a directly started watcher exited as soon as its parent was killed with SIGKILL. Behind a Node launcher of the same shape as `scripts/cli.cjs`, the launcher outlived its parent, so the native watcher kept running even with the variable set.

Scope: processes started for the watch, directly or through the launcher. Other long-running commands, such as `backlog browser` run as a service, keep their current lifetime.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When the process that started `backlog task list --json --watch` exits or is killed, including with SIGKILL, the watcher exits without waiting for a task change
- [x] #2 The same holds when the watch starts through the npm launcher: neither the launcher nor the native binary outlives the process that started the launcher
- [x] #3 While that process lives, the watch keeps emitting complete task lists, and signalling the process group of a launched watch still stops both the launcher and the native binary
- [x] #4 Automated tests kill the starting process with SIGKILL and find no remaining watcher, for a direct binary and for the npm launcher
- [x] #5 Watch help and CLI instructions state that the watch ends when the process that started it ends
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Launcher (scripts/cli.cjs): pass the native binary one internal, undocumented env value naming the launcher and the process that started it (launcher pid:parent pid). Inert for every command except the watch; no launcher lifetime, exit-code, signal or arg-cleaning change.
2. Watch (src/commands/watch-json.ts): at watch start record the starting process: the direct parent, plus the launcher's parent when the env value names this process's parent as the launcher (a stale value inherited through other processes is ignored). On the existing 1 s reconcile tick, stop like SIGTERM (exit 143 via the existing forced-exit path) once the parent changed (POSIX reparenting) or a recorded process no longer exists (kill 0 -> ESRCH, covers Windows and the launcher's parent). No Bun no-orphans: it is process-wide, also SIGKILLs descendants, is POSIX-only and cannot cover the Node launcher.
3. Tests (src/test/cli-json-watch.test.ts): a throwaway starter (bun -e) hands its stdio to the watch and is SIGKILLed; stdout EOF within a bound proves no starter, launcher or watcher still holds it. Direct: bun CLI. Launcher: node scripts/cli.cjs with a fixture platform package whose binary is a copy of the running Bun executable, so it runs on all CI OSes. Detached group kill as cleanup.
4. Help and instructions: one sentence in the watch help field, CLI instructions overview, and CLI-INSTRUCTIONS.md.
5. Verify: tsc, biome, scoped then full tests, manual SIGKILL e2e for dist/backlog and node scripts/cli.cjs with ps, plus process-group SIGTERM of a launched watch. Simplification pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Design: the npm launcher passes the native binary an internal, undocumented BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid>; it is inert for every command except the watch. The watch records its parent, plus the launcher's parent when that value names its own parent as the launcher (stale values inherited through other processes are ignored). On its existing 1 s reconcile tick it stops like SIGTERM (exit 143, existing forced-exit path) once its parent PID changed (POSIX reparenting) or a recorded process no longer exists (kill 0 returns ESRCH; covers Windows and the launcher's parent). Launcher lifetime, exit codes, signal mapping and arg cleaning are unchanged: when the watch exits, the launcher exits with its code.

Not Bun no-orphans: it is process-wide (would also end backlog browser), SIGKILLs every descendant on exit, is a no-op on Windows, and cannot cover the Node launcher.

Known limits: through the launcher, the starter's exit is seen once its own parent has reaped it (kill 0 succeeds on zombies; shells, Node, Bun and init reap immediately). PID reuse within one tick would delay detection. An intermediate such as npx stays the launcher's parent, so it is what the watch follows.

Tests: src/test/cli-json-watch.test.ts starts the watch from a throwaway bun -e starter that hands it stdout and stderr, checks it still follows a task change after one liveness tick, SIGKILLs the starter, and requires stdout EOF (no starter, launcher or watch still holds it) within 5 s. Direct: bun CLI. Launcher: node scripts/cli.cjs with a fixture platform package whose binary is a copy of the running Bun, so it runs on every CI OS without a skip. Both tests failed on the unfixed code (timeout waiting for exit) and pass with the fix; the launcher test still failed with only the watch change and passed once the launcher passed the value.

Manual e2e on macOS (bun run build; launcher dir = scripts/cli.cjs + scripts/resolveBinary.cjs with node_modules/backlog.md-darwin-arm64/backlog = dist/backlog). Starter: a bash -c process that runs the command in the background and waits; then kill -9 on the starter and poll ps -o pid= -p for the watch and launcher PIDs.
- dist/backlog task list --json --watch: 5 of 5 runs nothing left 0.07-1.03 s after SIGKILL, stderr empty.
- node launcher/cli.cjs task list --json --watch: 5 of 5 runs launcher and native gone 0.09-0.77 s after SIGKILL.
- Baseline binary without the fix: watcher still running with PPID 1 five seconds after SIGKILL.
- Launched watch as its own process group (perl setpgrp): kill -TERM, -KILL and -INT on the group remove launcher and native within 0.1 s; launcher exit 143, 137, 130; stderr empty.
- kill -9 of only the launcher: the native watch exits.
- node launcher/cli.cjs browser --no-open under a SIGKILLed starter: launcher (PPID 1) and native still serve HTTP 200 three seconds later, lifetime unchanged.
- Stale BACKLOG_LAUNCHER values (unrelated PIDs, garbage) do not end a directly started watch.

Validation: bunx tsc --noEmit and bun run check . pass. bun test --timeout=10000 src/test/cli-json-watch.test.ts src/test/watch-json.test.ts src/test/cli-launcher.test.ts: 20 pass; cli-json-watch also passes against the CI-style bundle (BACKLOG_TEST_CLI_BUNDLE). With the liveness check disabled, both new tests fail (timeout waiting for the watch to exit) and leave no processes behind. Full bun run test on this Mac at normal load: 2893 pass, 8 skip, 1 fail (board-tui-move.test.ts, unrelated TUI flake that passes 3 of 3 alone). Later full runs were stopped because other sessions pushed the load average to 80-97 and caused timeouts across unrelated files; CI is the clean full-suite check. Test runs under load leaked unrelated fixture files into the worktree backlog; they were deleted and not committed.

Review follow-up: the starter is now captured when watch-json.ts loads at CLI startup, before parsing and project lookup; with a starter that exits 0.12 s after spawning, the PR-head build leaked the watch and the new build ends it (exits within about 0.08 s of process start, before the CLI modules load, still escape). Launcher fixture shared with cli-launcher tests via createLauncherInstall. Known limit: on Windows npm installs the launcher runs through the backlog.cmd shim, so the launcher's parent is cmd.exe and the watch follows it, as in the npx case.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task list watches now end when the process that started them ends, including after SIGKILL, both for the compiled binary and through the npm launcher. The launcher passes the native binary an internal BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid> that other commands ignore. On its existing 1 s reconcile tick the watch ends like SIGTERM (exit 143) once its parent changed or a recorded starter process no longer exists; the launcher then exits with the watch's code. Other commands, including backlog browser run as a service, keep their lifetime. Watch help, the CLI instructions overview and CLI-INSTRUCTIONS.md now state that the watch ends with the process that started it.

Verified with new SIGKILL tests in src/test/cli-json-watch.test.ts for a direct watch and a launcher-started watch. They run on every CI OS and failed before the fix. Also verified with tsc, biome and the watch/launcher test files, plus a manual macOS e2e with dist/backlog and node scripts/cli.cjs. In that e2e nothing was left 0.07-1.03 s after SIGKILL of the starter. Group SIGTERM/SIGKILL/SIGINT still stops both launcher and native, and the browser service outlives its killed starter. Known limit: through the launcher, the watch notices a killed starter only once that starter's own parent has reaped it.
<!-- SECTION:FINAL_SUMMARY:END -->
