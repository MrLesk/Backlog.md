---
id: BACK-538
title: Fix port availability probe so browser port congestion handling works on macOS
status: Done
assignee:
  - '@claude'
created_date: '2026-07-12 14:58'
updated_date: '2026-07-12 15:02'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
isPortAvailable probes 127.0.0.1 while Bun.serve binds the wildcard interface. On macOS a loopback-specific bind does not collide with a wildcard bind, so the probe returns true even when the port is held by a running server (verified live on main f73ddc0). The BACK-473 congestion flow (warning + next-free-port prompt) therefore never triggers, and two backlog browser instances can silently share a port. The port tests only pass because the test fixture binds 127.0.0.1 as well, mirroring the buggy probe instead of the production server.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 isPortAvailable returns false for a port held by a real production-style server (regression test starts an actual Bun.serve/BacklogServer and asserts the probe fails)
- [x] #2 Port congestion handling (warning and next-free-port flow) triggers on macOS when the default port is occupied
- [x] #3 Test fixtures probe/bind the same interface as the production server so this defect class cannot pass CI silently
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bind the isPortAvailable probe to the same wildcard interface Bun.serve uses (drop the 127.0.0.1 argument) so specific-vs-wildcard bind semantics on macOS cannot make the probe pass on an occupied port.
2. Update listenOnEphemeralPort test fixture to bind the wildcard default, mirroring production instead of the old buggy probe.
3. Add a regression test that starts a real Bun.serve (production-style, default hostname) and asserts isPortAvailable returns false while it runs and true after it stops; this test fails on macOS before the fix.
4. Re-verify the non-TTY congestion flow test (cli-browser-port.test.ts) and the server-port suite; run tsc + biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Probe now binds the wildcard interface (dropped 127.0.0.1 from isPortAvailable and the listenOnEphemeralPort fixture). Regression test starts a real Bun.serve and asserts the probe returns false while running and true after stop; this fails against the old probe on macOS. End-to-end verified live: two 'backlog browser --port 6431 --no-open' instances on macOS, second printed 'Port 6431 is already in use. Using port 6432 instead.' bun test server-port + cli-browser-port: 9 pass, tsc clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
isPortAvailable probed 127.0.0.1 while Bun.serve binds the wildcard interface, so on macOS the BACK-473 port-congestion flow never triggered and two browser instances silently shared a port. The probe and the test fixture now bind the same wildcard interface as production, with a Bun.serve-based regression test. Verified by unit tests and a live two-instance run that relocated to the next free port.
<!-- SECTION:FINAL_SUMMARY:END -->
