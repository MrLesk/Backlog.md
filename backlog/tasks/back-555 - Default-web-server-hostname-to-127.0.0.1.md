---
id: BACK-555
title: Default web server hostname to 127.0.0.1
status: Done
assignee:
  - '@codex'
created_date: '2026-07-23 22:01'
updated_date: '2026-07-23 23:08'
labels: []
dependencies: []
modified_files:
  - src/server/index.ts
  - src/cli.ts
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix GitHub issue #810: the web UI server binds to 0.0.0.0 (all interfaces) with zero auth, exposing the full task API on the LAN. BacklogServer.start() should default hostname to 127.0.0.1 and accept an explicit hostname override; the CLI browser command should accept a --host <address> option.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 BacklogServer.start() with no hostname arg binds to 127.0.0.1, not Bun's wildcard default
- [x] #2 start() accepts a third positional hostname argument and honors it when passed
- [x] #3 browser command accepts --host <address> and boots the server successfully when passed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an optional hostname parameter to BacklogServer.start and pass hostname ?? 127.0.0.1 to Bun.serve (src/server/index.ts:L276-L298; src/test/server-hostname.test.ts:L44-L55).
2. Add browser --host <address> and pass options.host as start argument three without changing the localhost startup log (src/cli.ts:L4960-L5013; src/test/cli-browser-host.test.ts:L73-L88).
3. Run the pinned tests, TypeScript, Biome write/check, and full suite; report exact counts (GitHub issue #810).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defaulted BacklogServer.start() hostname to 127.0.0.1 and added a --host <address> opt-in on the browser CLI command, threaded through as a third start() argument. Verified: bunx tsc --noEmit clean, bunx biome lint . clean, full bun test suite 1770 pass/15 skip/1 pre-existing-baseline fail (unrelated, confirmed via stash-and-rerun on unmodified main). Frozen tests src/test/server-hostname.test.ts and src/test/cli-browser-host.test.ts: 3/3 pass (was 3 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
