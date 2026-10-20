---
id: BACK-784
title: Forward termination signals from the npm launcher to the native binary
status: Done
assignee:
  - '@mhrstmnn'
created_date: '2026-10-19 23:55'
updated_date: '2026-10-20 00:20'
labels: []
dependencies: []
references:
  - scripts/cli.cjs
  - src/test/cli-launcher.test.ts
  - 'https://github.com/MrLesk/Backlog.md/issues/1049'
type: bug
ordinal: 394000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On npm and Bun installs, `backlog` runs through the Node launcher `scripts/cli.cjs`, which starts the native binary and exits when the binary exits. The launcher installs no signal handlers. A supervisor, CI step, or agent harness that stops a command by signalling the PID it started (for example SIGTERM to `backlog browser`) ends only the launcher, and the binary keeps running, reparented to init and still holding its port. BACK-688 covered only `task list --json --watch` and deliberately left launcher signal handling unchanged. Reported in https://github.com/MrLesk/Backlog.md/issues/1049.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SIGTERM, SIGHUP, or SIGQUIT sent to the launcher PID stops the native binary, and the launcher exits only after the binary has exited
- [x] #2 The launcher exits with the same status the binary ended with, including the 128 + signal number mapping when the binary was killed by a signal
- [x] #3 Ctrl+C in a terminal, which delivers SIGINT to the launcher and the binary together, still ends both, and the binary does not receive SIGINT twice
- [x] #4 Commands that run without a signal keep their current exit codes, output, and argument handling
- [x] #5 Automated tests signal the launcher PID and find the binary stopped and the exit status preserved
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Launcher (scripts/cli.cjs), POSIX only: after spawning the binary, forward SIGTERM, SIGHUP and SIGQUIT received by the launcher to the binary, and install a no-op SIGINT handler so the launcher survives Ctrl+C and waits for the binary, which the terminal already interrupts directly (forwarding would deliver SIGINT twice). The existing exit handler keeps mapping the binary status, including 128 + signal number. Windows is unchanged: no POSIX signals to forward and child.kill would terminate forcibly.
2. Tests (src/test/cli-launcher.test.ts): fixture platform binary that is a Node script reporting its PID and received signals. Signal the launcher PID with SIGTERM/SIGHUP/SIGQUIT: binary receives it, launcher exits with the binary status (handled -> its code, default -> 128 + n), and no binary process remains. Ctrl+C simulation: SIGINT to the launcher process group; binary receives it once and the launcher exits with its code. Write tests first and confirm they fail on current code.
3. Verify: types, biome, scoped and full tests, manual check with the built binary behind the launcher (`backlog browser` + kill -TERM launcher PID; port released). Simplification pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tests first: the five new signal tests failed on the unfixed launcher (it died by the signal) and pass with the fix. Mutation check: forwarding SIGINT as well makes the Ctrl+C test fail (binary reports SIGINT twice).

Considered and rejected: switching `backlog browser` and `backlog mcp start` signal handlers from process.once to process.on. A supervisor that signals the whole process group now delivers SIGTERM/SIGHUP/SIGQUIT to the binary twice (directly and forwarded); the second one hits the default disposition and ends a graceful shutdown early (exit 143 instead of 0). Keeping once preserves the existing escape hatch that a second Ctrl+C or SIGTERM force-quits a hung shutdown (MCP stop has no timeout), which matters more than the exit code on a group-wide stop. Launcher-only change keeps binary behavior identical for Homebrew, Nix, and standalone installs.

Manual e2e on macOS (bun run build; scratch launcher install = scripts/cli.cjs + scripts/resolveBinary.cjs with node_modules/backlog.md-darwin-arm64/backlog = dist/backlog; temp project; `node cli.cjs browser --no-open --port 46231 &`, then kill -<signal> on the launcher PID):
- Fixed launcher: SIGTERM -> launcher exit 0 (browser graceful shutdown), binary gone, port closed. SIGQUIT -> exit 0, same. SIGHUP -> exit 129 (browser does not handle SIGHUP, so 128 + 1 mapped), binary gone, port closed.
- Launcher from main, same binary: SIGTERM/SIGHUP/SIGQUIT -> launcher exit 143/129/131, binary still running, port still answering HTTP 200 (the #1049 symptom).

Known limits: SIGINT sent only to the launcher PID (not its process group) is waited out and not forwarded, so the binary keeps running and the launcher keeps waiting instead of orphaning it; use SIGTERM for a single-PID stop. A binary that ignores a forwarded signal now keeps the launcher waiting as well, the same as running the binary directly. The TUI reads Ctrl+C as a key in raw mode, so it is unaffected. Windows behavior is unchanged.

Checks: bun run check:types and bun run check . pass. src/test/cli-launcher.test.ts: 11 pass (6 existing launcher tests unchanged, covering args, exit codes and install errors). Full bun run test on this branch: 3572 pass, 19 fail; the same run on clean main also has 19 failures (the same 18 decision/document creation tests in cli-decision-archive and cli-create-preserves-existing-files, plus one ContentStore watcher timeout that differs between runs). Those files pass when run alone on both branch and main; in the full run their stdout gains a "Remote operations disabled" line. Not related to the launcher. The npm launcher watch tests in cli-json-watch.test.ts pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The npm launcher (`scripts/cli.cjs`) now stays alive until the native binary exits. On POSIX it forwards SIGTERM, SIGHUP and SIGQUIT received on its own PID to the binary, then exits with the binary status through the existing exit handler (the binary exit code, or 128 + signal number). SIGINT gets a no-op handler: Ctrl+C already reaches the binary from the terminal, so the launcher waits instead of delivering it a second time. Windows is unchanged.

Why: supervisors, CI steps and agent harnesses stop a command by signalling the PID they started. Before this change, that ended only the launcher and left the binary running with its port open (#1049).

Tests: five new launcher tests in src/test/cli-launcher.test.ts use a Node fixture binary to cover the forwarded signals, exit-status mapping and single delivery on Ctrl+C. All five failed on the old launcher. Manual e2e with `backlog browser` behind the launcher: the binary exits and the port closes for TERM, HUP and QUIT, while the old launcher leaves it serving.

Limits: SIGINT sent to the launcher PID alone is waited out, not forwarded. A binary that ignores a forwarded signal keeps the launcher waiting too, the same as running it directly. Browser and MCP signal handling deliberately stays `once` (see notes).
<!-- SECTION:FINAL_SUMMARY:END -->
