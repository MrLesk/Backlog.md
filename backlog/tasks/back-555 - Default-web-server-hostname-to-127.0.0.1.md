---
id: BACK-555
title: Default web server hostname to 127.0.0.1
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-23 22:01'
updated_date: '2026-07-23 22:05'
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
- [ ] #1 BacklogServer.start() with no hostname arg binds to 127.0.0.1, not Bun's wildcard default
- [ ] #2 start() accepts a third positional hostname argument and honors it when passed
- [ ] #3 browser command accepts --host <address> and boots the server successfully when passed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an optional hostname parameter to BacklogServer.start and pass hostname ?? 127.0.0.1 to Bun.serve (src/server/index.ts:L276-L298; src/test/server-hostname.test.ts:L44-L55).
2. Add browser --host <address> and pass options.host as start argument three without changing the localhost startup log (src/cli.ts:L4960-L5013; src/test/cli-browser-host.test.ts:L73-L88).
3. Run the pinned tests, TypeScript, Biome write/check, and full suite; report exact counts (GitHub issue #810).
<!-- SECTION:PLAN:END -->
