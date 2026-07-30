---
id: BACK-560
title: Bind the browser server to loopback only
status: To Do
assignee: []
created_date: '2026-07-30 17:39'
labels:
  - browser
  - security
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/810'
  - 'https://github.com/MrLesk/Backlog.md/pull/811'
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
