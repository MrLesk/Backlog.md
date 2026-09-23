---
id: BACK-689
title: Keep idle task list watchers from using constant CPU
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 19:35'
updated_date: '2026-09-23 21:47'
labels: []
dependencies: []
references:
  - src/commands/watch-json.ts
modified_files:
  - src/commands/watch-json.ts
  - src/test/watch-json.test.ts
type: bug
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Programs that show live task lists keep `backlog task list --json --watch` (BACK-686) running for as long as they are open, often several at once. Between task changes the watch should sit idle, but it does not: on 2026-09-23 on macOS, a watcher started by another program in a larger repository used a steady 38% CPU (6m23s of CPU time over 17 minutes), and the maintainer sees about 30% per instance. A watcher in a small scratch repository on the same machine stayed under 1%, so the cost appears to depend on the repository being watched. The cause is not yet known.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With no task changes, an idle watch averages under 1% CPU over a 60-second sample in a repository where the high usage reproduces before the fix
- [x] #2 Task changes still produce a complete updated task list promptly, with the existing JSON output unchanged
- [x] #3 The root cause and before/after CPU measurements, with the commands used, are recorded in the implementation notes
- [x] #4 An automated test guards the identified cause without asserting on measured CPU time
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Investigation: watchJson (src/commands/watch-json.ts) runs setInterval(refresh, 1000), so every second it performs the full canonical task-list read (new Core, duplicate scan, task query, completed corpus for readiness, JSON serialization) even when nothing changed. No filesystem notifications fire while idle (verified with a recursive fs.watch counter over groma3/backlog: 0 events in 10 s). In groma3 (644 entries under backlog/) one read costs ~0.4-0.6 s CPU, so the reconciliation alone is ~40% CPU; in a small repo the read is cheap, hence <1%. The browser and TUI use ContentStore/fs.watch without this poll and are not affected.

1. Keep the BACK-686 reconciliation guarantee (no permanent missed changes) but make its idle check cheap: each second compare a stat signature (entry names, file size and mtime) of the watched directories, mirroring the notification scope (first directory recursive, others direct entries), with the signature taken just before each read; only a differing signature schedules a read. Notifications still trigger reads directly, so reaction time and output are unchanged.
2. Replace the in-memory-only reconciliation unit test with (a) an idle watch that must not repeat its read and (b) a signature test for same-size edits, creation, removal and scope; keep CLI watch tests green.
3. Measure before/after CPU for a watcher in /Users/alex/projects/groma3 over 60 s with ps -o time, manual change check in a scratch repo, then tsc, biome, targeted tests, full test suite; simplification pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: src/commands/watch-json.ts ran setInterval(refresh, 1000), so every second the watch repeated the full canonical task-list read (new Core, duplicate-ID scan, task query, completed corpus for readiness, JSON serialization) even with no changes. The CPU therefore scaled with repository size: in /Users/alex/projects/groma3 (645 entries under backlog/, 485 of them completed tasks) one read costs ~0.4-0.6 s CPU, while a scratch repo's read is nearly free. Filesystem notifications were not involved: a recursive fs.watch counter over groma3/backlog saw 0 events in 10 s of idle, and a build whose timer did nothing idled at 0.05%. The browser and TUI use ContentStore watchers without this poll and are unaffected, so the fix stays in watch-json.ts, the only user of this change-detection path.

Fix: keep the BACK-686 reconciliation for missed notifications but reconcile with a stat signature (entry names plus file size and mtime, same directories and recursion as the notifications, taken just before each read). The one-second timer only compares signatures and schedules a read when they differ. Notifications still trigger reads directly, so update latency, filters, scope and JSON output are unchanged; a missed notification is still repaired within about a second.

Measurements (macOS, groma3, binaries from bun run build: main at 26c897d4 vs this branch; both watchers run side by side with cwd /Users/alex/projects/groma3 and 'backlog task list --json --watch > file'; CPU time read with 'ps -o pid,pcpu,time -p <after>,<before>' 60 s apart with no task changes in the window):
- Before: 0:35.40 -> 0:56.87 = 21.47 s CPU in 60 s (35.8%). Earlier idle run: 0:08.03 -> 0:33.14 = 25.11 s (41.9%).
- After: 0:02.86 -> 0:03.27 = 0.41 s CPU in 60 s (0.68%). Other idle runs: 0.65%, 0.72%, 0.80%, 0.87%.
- Remaining idle cost is the stat pass itself (~3-5 ms of syscalls per 650 entries on macOS, plus GC of its allocations), so it grows with the number of files under backlog/ (worktree with 768 entries: 0.88%).
- During the final sample an external program edited groma3 tasks; both watchers emitted the same 3 snapshots byte for byte.

Manual check in a scratch repo (backlog init --defaults --no-git, one task): 'backlog task edit 1 -s "In Progress" --priority high' produced a second snapshot 0.07 s after the command returned, equal to one-shot 'backlog task list --json'.

Tests: replaced the in-memory-only reconciliation test with (a) an idle watch that must not repeat the read for 2.5 s (fails on main with 3 reads) and (b) a filesSignature test covering same-size edits, creation, removal, and scope.

Simplification pass: inlined the scope type, reduced the error fallback to String(error), and kept one shared scope list for both the notification watchers and the signature. Checked that readdirSync recursion follows symlinked directories like the loaders' followSymlinks globs, and that a symlink loop throws ELOOP (caught; notifications still work). Docs already say the command reconciles periodically as well as on notifications, so no public text changed.

Validation: bunx tsc --noEmit and bun run check . pass. bun test --timeout=10000 src/test/watch-json.test.ts src/test/cli-json-watch.test.ts: 13 pass. The new idle test fails on main's timer (3 reads instead of 1). bun run test: first run 2892 pass, 8 skip, 1 fail; a rerun under load average 70-98 from other processes on this Mac hit 10 s timeouts in unrelated subprocess-heavy files (cli-list-window, cli-refs-docs, acceptance-criteria, server-statistics-endpoint). Those 4 files then passed with bun test --timeout=60000 (88 pass, 0 fail). None of them use --watch.

Open tradeoff: the remaining idle cost is the 1 s stat pass, roughly 1% per ~800 files under backlog/ on macOS. Raising the reconciliation interval would divide it but also slow repair when notifications are missed. The interval was left at 1 s so behavior matches BACK-686.

Review follow-up (PR #1036): the first signature used recursive readdirSync, which follows directory symlinks with no cycle check. With symlink loops under backlog/ (copy of groma3's backlog), one loop cost ~21-25 ms per pass instead of ~4 ms, and two loops never finished: the cb6e5e21 binary emitted no list and ignored SIGTERM. Main was unaffected because its task loaders glob single directories. Bun.Glob with followSymlinks looked cycle-safe under Bun 1.4.1 but walks loops to the link limit under Bun 1.3.14, the pinned release/CI runtime that 'bun run build' uses. The signature now walks each real directory once (keyed by realpath), follows symlinked files and directories, skips dotfiles like the loaders, and records ctime next to size and mtime, so a copy that preserves mtime (cp -p) still differs.

Measured with 'bun run build' binaries side by side under load average 30-40 (first list; CPU between 10 s and 70 s; exit after SIGTERM):
- One loop: main 7.09 s, 13.80 s (23%), 0.91 s. Fix 7.44 s, 0.57 s (0.95%), 0.12 s.
- Two loops: main 3.11 s, 15.69 s (26%), 0.56 s. Fix 2.89 s, 0.54 s (0.90%), 0.13 s.
- Static copy of groma3's backlog, no loops: main 13.45 s (22%). Fix 0.53 s (0.88%).
- Symlinked tasks dir and symlinked task file, edited at their targets: the backlog watcher saw 0 notifications. The fix updated after 0.98 s both times (main 0.90/0.96 s), and both final lists matched one-shot --json.

The new test covers symlinked files and directories and two cycles. With the cb6e5e21 code under Bun 1.3.14 it hangs. tsc, Biome and the watch tests (14 pass) pass under Bun 1.4.1 and 1.3.14. The symlink test is skipped on Windows, where creating symlinks needs extra privileges.

Re-review fixes: per-entry stat and readdir errors (self or mutual links, unreadable subdirectories) now count that entry by name instead of turning the whole signature into one error string. The directory-link test uses junctions so it also runs on Windows; only the file-link, looping-link and chmod test is skipped there. Checks pass under Bun 1.4.1 and the pinned 1.3.14 (23 tests across watch-json, cli-json-watch and cli-launcher).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Idle task list watches no longer repeat the full task-list read every second. Before the fix, the 1 s reconciliation timer in src/commands/watch-json.ts reran the canonical read even with no changes, so idle CPU grew with repository size: 36-42% in groma3. The timer now compares a cheap stat signature (entry names, file sizes, mtimes) with the same scope as the notifications, and reads only when it differs. Notifications still trigger reads directly, so filters, scope, JSON bytes and update latency are unchanged, and missed notifications are still repaired within about a second.

Verified in groma3 with main vs branch binaries side by side over 60 s: 21.47 s vs 0.41 s CPU (35.8% vs 0.68%). During an external edit both emitted identical snapshots. In a scratch repo, a CLI edit produced the updated list 0.07 s later, equal to one-shot --json. A new unit test fails on the old timer and checks the signature; tsc, Biome and the watch tests pass. Full-suite timeouts under heavy machine load were in unrelated files, which passed on rerun.
<!-- SECTION:FINAL_SUMMARY:END -->
