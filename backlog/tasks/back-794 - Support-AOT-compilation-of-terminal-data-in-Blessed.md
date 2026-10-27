---
id: BACK-794
title: Support AOT compilation of terminal data in Blessed
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-27T22:07:00Z'
updated_date: '2026-10-27T22:11:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/neo-neo-blessed/tree/no-node-pty
  - https://github.com/oven-sh/bun/pull/45631
modified_files:
  - backlog/attachments/back-794/blessed-aot.patch
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bun AOT follows require.resolve calls in the terminal dependency and parses binary terminfo as JavaScript. The owned neo-neo-bblessed publishing branch can fix filesystem data resolution at its source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backlog source compiles with AOT using the patched Blessed dependency without parsing terminfo as JavaScript
- [ ] #2 Blessed retains disk terminfo and embedded fallback behavior under Node and Bun
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Replace only filesystem-data module resolution in Blessed. Extend focused terminal-data regression coverage, run the fork checks, then compile and smoke-test Backlog with the built fork. Keep release defaults unchanged and preserve patch/review evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation is in the owned MrLesk/neo-neo-blessed repository, branch aot-terminfo based on no-node-pty 44da731. Changed lib/tput.ts: use filesystem paths for three terminal-data loads, preserving existing disk-first behavior and embedded fallback. No Backlog source or release build defaults changed.

Added fork regression test test/unit/tput-data.test.ts: all 3 tests pass, covering packaged binary terminfo, packaged termcap, and embedded fallbacks for named and xterm terminal data. Fork npm run build succeeds for CJS/ESM/types.

Fork fix committed locally as 8725fc4 (parent 44da731). Source patch attached at backlog/attachments/back-794/blessed-aot.patch because GitHub create_tree returns HTTP 403 Resource not accessible by integration for MrLesk/neo-neo-blessed and git push has no credentials. Requires granting the connected GitHub app write access to that fork before opening its PR. Tested the built fork in Backlog node_modules without altering Backlog source or release defaults: AOT and AOT+trim both compile and pass the complete scripts/smoke-compiled-build.ts suite. AOT+trim TUI rendered two tasks, arrow navigation opened the second task detail, Escape returned and q exited 0. All 413 fork tests pass; build/types/lint pass (661 existing lint warnings). Full check is blocked only by pre-existing formatting in .github/workflows/manual-publish.yml, confirmed against original HEAD; changed files pass Prettier. Same-compiler 2-task list benchmark: 10 measured runs after 2 warmups, identical JSON. JIT bytecode 157207240 bytes, median 48.61ms, 63904 KiB peak RSS; AOT 104930248 bytes, 23.00ms, 46332 KiB; AOT+trim 80607496 bytes, 20.83ms, 44008 KiB. These are Linux x64 small-fixture measurements, not platform qualification or universal speedups.
<!-- SECTION:NOTES:END -->
