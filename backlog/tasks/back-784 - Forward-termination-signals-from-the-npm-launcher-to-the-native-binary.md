---
id: BACK-784
title: Forward termination signals from the npm launcher to the native binary
status: Done
assignee:
  - '@codex-1127'
created_date: '2026-10-19 23:55'
updated_date: '2026-10-20T03:41:00Z'
labels: []
dependencies: []
references:
  - scripts/cli.cjs
  - src/test/cli-launcher.test.ts
  - 'https://github.com/MrLesk/Backlog.md/issues/1049'
  - 'https://github.com/MrLesk/Backlog.md/pull/1127'
  - src/cli.ts
  - src/commands/mcp.ts
modified_files:
  - scripts/cli.cjs
  - src/test/cli-launcher.test.ts
  - src/cli.ts
  - src/commands/mcp.ts
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
- [x] #6 Repeated browser SIGTERM/SIGQUIT and MCP SIGTERM/SIGHUP during shutdown complete cleanup once, including group delivery through the npm launcher
- [x] #7 Browser and MCP still complete cleanup after one terminal Ctrl+C and permit a second Ctrl+C to force exit
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the contributor commit and reproduce the parent-PID leak on unchanged main.
2. Record Alex approval and change only browser TERM/QUIT and MCP TERM/POSIX HUP registrations to persistent handlers with existing guards.
3. Add actual-owner delayed-cleanup regressions and prove failure before / success after while preserving Ctrl+C behavior and owned cleanup.
4. Rebuild JS/native artifacts, run focused tests, types, Biome, native smoke and real PID/group/PTY proof; preserve the earlier broad-profile limitation.
5. Complete the required architecture review (KEEP), finalize the task through the CLI, and create a normal scoped commit and non-force push to the existing contributor branch. Root owns final-head remote gates and merge approval.
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

Maintainer preparation reopened the contributor task for review. Original commit 1b6715e292fddefe3132ae5b91980daaa5d6adef by mhrstmnn is preserved. The following evidence and test repairs supersede earlier completion claims; final review, commit, and push remain pending.

Maintainer validation (macOS arm64; Bun1.4.3; Node24.13.0): unchanged main e142143a PID TERM/HUP/QUIT left the compiled browser alive with HTTP200. Original PR1b6715e stops it, closes the port, and reports0/129/0. Group Ctrl+C through a real PTY delivers one SIGINT to the fixture and completes browser shutdown with exit0. Original contributor signal tests:6pass/5fail with main launcher;11pass with PR launcher. Hardened tests bound readiness/exit/output waits and own the entire process group before startup; a missing-readiness mutation fails in3s and both owned PIDs are gone after cleanup. Forwarding SIGINT mutation fails on two deliveries.

Proven unresolved behavior decision: a disposable fixture using process.once and500ms delayed cleanup completes on group TERM/QUIT with main in10/10 trials each, but PR completes in0/10 each (launcher143/131). Idle actual browser group TERM/QUIT still exits0. Root has escalated the concrete four-handler proposal (browser TERM/QUIT and MCP TERM/HUP use on with existing idempotence guards) to Alex. Native shutdown owners remain unchanged pending that decision. Do not treat the original contributor notes as approval of this regression.

Focused launcher/watch/packaging/resolve/MCP checks:43pass/0fail. Types, Biome, build, native compiled smoke and git diff --check pass. Correct full CI JS profile remains running at this note. Untouched doc archive interactive viewer fails on whitespace; the same isolated failure reproduces against unchanged-main source snapshot and this branch. No unrelated fix applied. Groma scanner coverage excludes scripts/cli.cjs and src/test/cli-launcher.test.ts, so the modified-file links are recorded but no current owner is available for either file. Proof logs and scripts are under /private/tmp/back-784-*; a frozen handoff will name exact paths.

Completed independent validation before the pending behavior decision: the exact full CI profile with BACKLOG_TEST_CLI_BUNDLE=/private/tmp/back-784-test-cli/cli.js finished with 3192 pass / 13 skip / 1 fail in the non-DOM pass and 399 pass / 0 fail in the serial DOM pass (overall 3591 pass / 13 skip / 1 fail; exit 1). The sole failure is the unchanged-main archived-document viewer whitespace assertion already reproduced in isolation. All 12 launcher tests passed in this full run. Logs: /private/tmp/back-784-full.log; JUnit: /private/tmp/back-784-full.xml and /private/tmp/back-784-full-dom.xml.

Actual launcher error-path checks preserve exit 1 and expected guidance on main and PR for missing package, EACCES, ENOENT interpreter, SIGILL and SIGTRAP (10 cases). Proof: /private/tmp/back-784-errors-z7e1ilaz/results.json. Native compiled smoke passed. Test cleanup simplification reuses the existing observeChildClose/withTimeout helpers and adds no exported API. Current source patch is frozen for root review at /private/tmp/back-784-handoff; native owners remain unchanged. Task stays In Progress with every acceptance criterion and DoD item unchecked, pending the behavior decision and root architecture review.

Alex explicitly approved the four native registration changes after the repeated-signal tradeoff was explained (response: Fine by me). Approved scope: browser TERM/QUIT and MCP TERM/POSIX HUP use process.on with existing guards. Repeated termination now permits cleanup; browser keeps its 1500 ms limit and MCP keeps no stop timeout. SIGINT once/force behavior, launcher PID-only SIGINT, current platform gates, browser HUP and MCP QUIT defaults stay unchanged. This approval supersedes the earlier pending/rejected notes. Root retains architecture review, final-head CI and final external-contributor merge approval.

New owner regressions were run before the native changes: 16 pass / 4 fail. The failing cases execute the real CLI and actual server classes behind the npm launcher, delaying only Server.stop: browser TERM/QUIT exit 143/131 and MCP TERM/HUP exit 143/129 before cleanup completes. Browser/MCP single group SIGINT and second Ctrl+C force-exit checks already pass. Log: /private/tmp/back-784-owner-before.log. Applied only the four approved once-to-on registrations, keeping existing guard bodies and platform gates.

Final scoped validation after the approved native repair: 53 pass / 0 fail across cli-launcher, cli-json-watch, resolveBinary, packaging-bin, mcp-stdio-exit and cli-browser-port, using the rebuilt JS integration bundle /private/tmp/back-784-final-test-cli/cli.js. All 20 launcher/actual-owner cases pass. Final test source against a disposable control snapshot with the original once owners gives 2 SIGINT passes / 4 termination failures; exact control source hashes are /private/tmp/back-784-original-tests/owner-control-hashes.json and log /private/tmp/back-784-final-owner-control.log. The test wrapper changes only real server stop duration, loading the actual CLI and server classes behind the launcher.

Rebuilt compiled public proof with a real incomplete HTTP request: old native owner group TERM/QUIT exits 143/131 before cleanup; repaired native exits 0 with Server stopped after about 1.6 seconds. Control: /private/tmp/back-784-native-once-control-j0gnryf8/results.json. Repaired PID TERM/HUP/QUIT and group INT/TERM/QUIT proof: /private/tmp/back-784-final-native-97w96rw4/results.json. Fresh real PTY Ctrl+C delivers SIGINT once to the fixture and finishes rebuilt browser shutdown with exit 0: /private/tmp/back-784-pty-wy4ov0fc/results.json. Test cases also verify second Ctrl+C still forces browser/MCP exit 130.

Types, Biome, JS/native builds, compiled smoke and diff checks pass. Simplification removed the separate exit promise and redundant output waits: fixtures now share one bounded close observer. No exported helper, shutdown controller, new timeout or dependency was added. The earlier broad full-profile result (3591 pass / 13 skip / 1 proven main-baseline viewer failure) was before these four native registrations changed; no second broad local run was made. Final-head remote CI remains required, especially Linux/Windows. Final frozen patch, source/control hashes, logs and PR draft: /private/tmp/back-784-final-handoff. Task stays In Progress with all seven criteria and all DoD items unchecked, pending root architecture review. No commit, push or finalization.

Finalization evidence: the single full-context architecture review returned KEEP with no blocking findings or recommended code changes. Reviewer start/end source and patch hashes matched /private/tmp/back-784-final-handoff/manifest.json. Remote contributor branch was verified at original head 1b6715e292fddefe3132ae5b91980daaa5d6adef before finalization. All frozen source/test bytes matched the manifest.

AC1/5: automated launcher PID TERM/HUP/QUIT cases and rebuilt native proof stop the binary; native proof records closed ports and no binary left. AC2: fixture exit 3, unhandled-signal mapping 143, native browser 0 and HUP 129 preserve child status. AC3: real PTY fixture sees one SIGINT and rebuilt browser finishes cleanup with exit 0. AC4: argument, packaging, installation/error, watch and MCP compatibility checks pass in the final 53-test focused run. AC6: real owner tests fail for all four once registrations in the control and pass after repair; repeated requests call cleanup once. Compiled slow-request browser completes group TERM/QUIT cleanup with exit 0. AC7: browser/MCP single Ctrl+C cleanup passes and their second Ctrl+C still forces exit 130. DoD1/2: final types and Biome pass. DoD3: focused tests 53 pass / 0 fail; native/JS builds, compiled smoke and diff checks pass. Final-owned PID probe checked 22 processes, all gone: /private/tmp/back-784-final-handoff/owned-process-cleanup.json.

Limits: the earlier broad local profile was before the four native handler changes and had 3591 pass / 13 skip / 1 archived-document viewer failure independently reproduced on main. It is not evidence of a green final-patch full run. Linux/Windows and all final-head remote gates remain with root, as do PR discussion and Alex final external-contributor merge approval. No code/test edits or second broad run were made during finalization.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The npm launcher forwards POSIX TERM/HUP/QUIT, waits for the native binary, and returns its status so PID termination does not leave an orphan. Browser TERM/QUIT and MCP TERM/HUP now use persistent handlers with existing guards, allowing repeated termination to finish cleanup. Ctrl+C single delivery and second-Ctrl+C force exit are preserved; browser keeps its 1500 ms limit and MCP keeps no stop timeout.

Verified with 53 focused tests, actual-owner before/after regressions, rebuilt native PID/group and slow-request proof, real PTY Ctrl+C, types, Biome, build, compiled smoke and process cleanup checks. The architecture review returned KEEP. The earlier broad profile predates the native repair and has a proven main-baseline viewer failure; final-head remote CI and merge approval remain with root. Original contributor commit and authorship are preserved.
<!-- SECTION:FINAL_SUMMARY:END -->
