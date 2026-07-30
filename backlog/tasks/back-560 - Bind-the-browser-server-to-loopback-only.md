---
id: BACK-560
title: Bind the browser server to loopback only
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 17:39'
updated_date: '2026-07-30 17:54'
labels:
  - browser
  - security
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/810'
  - 'https://github.com/MrLesk/Backlog.md/pull/811'
modified_files:
  - src/server/index.ts
  - src/cli.ts
  - src/test/test-utils.ts
  - src/test/server-port.test.ts
  - src/test/cli-browser-port.test.ts
  - src/test/server-hostname.test.ts
  - README.md
  - CLI-INSTRUCTIONS.md
  - backlog/docs/doc-003 - Running-Backlog-Browser-as-a-Service.md
priority: high
type: bug
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The local browser server currently omits Bun hostname configuration, which binds an unauthenticated read/write API to all network interfaces while displaying a localhost URL. Restrict the supported browser server to loopback only and keep binding, port probing, displayed URLs, automatic opening, documentation, and tests consistent with that policy. Take over the safe core of PR #811 without adding its unauthenticated non-loopback --host capability.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog browser binds explicitly to 127.0.0.1 by default and does not accept a public host override.
- [ ] #2 Port availability probing checks the same 127.0.0.1 interface used by the production server, including advancing when a loopback port is occupied.
- [ ] #3 Startup output and automatic browser opening use the actual loopback URL.
- [ ] #4 The browser API is not reachable through a machine LAN or VPN address under the supported default behavior.
- [ ] #5 CLI help and browser documentation describe the interface as local-machine only and do not advertise unauthenticated external hosting.
- [ ] #6 Tests cover explicit loopback binding, occupied-loopback-port selection, displayed and opened URL behavior, and unchanged --no-open behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. RED: Update the shared ephemeral-port fixture and port regressions to model an explicit 127.0.0.1 listener; add a real BacklogServer startup test that expects the bound hostname, displayed URL, automatic-open URL, and --no-open behavior to use 127.0.0.1; add CLI help coverage for local-machine-only wording and absence of --host. Run the focused server and CLI tests before production changes and confirm failures match the wildcard/localhost behavior.
2. GREEN: In src/server/index.ts, define one internal 127.0.0.1 browser host value and reuse it for net probing, Bun.serve hostname, and the displayed/opened URL without adding any hostname parameter. Update the browser command description and README, CLI reference, and service guide to state that the Web UI is available only on the local machine.
3. REFACTOR AND VERIFY: Keep the implementation to the shared constant and existing paths, then run the focused port/startup/CLI tests, relevant broader server tests, typecheck, Biome, a live loopback-versus-LAN/VPN reachability check when an external interface is available, git diff --check, and a final scope/simplification review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented loopback-only browser serving with a single internal 127.0.0.1 host constant shared by the port probe, Bun server binding, displayed URL, and browser launch URL. Updated browser help and public docs to state the local-only boundary.

Verification:
- RED: focused hostname/port/CLI suite produced 8 expected failures before implementation.
- GREEN: focused suite passed 12 tests with 0 failures.
- Broader server suite passed 74 tests with 0 failures.
- Full suite passed 1,782 tests with 4 skipped and 0 failures across 200 files.
- bunx tsc --noEmit passed.
- bun run check . passed for 340 files.
- git diff --check passed.
- Live network proof returned HTTP 200 on 127.0.0.1 while the available Wi-Fi and VPN IPv4 addresses were unreachable.
<!-- SECTION:NOTES:END -->
