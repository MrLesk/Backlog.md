---
id: BACK-414
title: Document running backlog browser as a background service
status: In Progress
assignee:
  - '@brenoperucchi'
created_date: '2026-04-22 15:13'
updated_date: '2026-04-22 15:17'
labels:
  - docs
  - browser
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a 'Running as a service' section to README.md showing how to keep `backlog browser --no-open` running in the background and auto-starting on boot on Linux (systemd user unit), macOS (launchd LaunchAgent), and Windows (NSSM or Scheduled Task). Add a cross-reference in CLI-INSTRUCTIONS.md. Related: upstream issue #335 (containerization) addresses a different deployment shape; this docs task covers the local-service use case.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md has a new 'Running as a service' section after the Web Interface section
- [x] #2 Section shows a working systemd user unit snippet using 'backlog browser --no-open'
- [x] #3 Section includes macOS launchd and Windows guidance
- [x] #4 CLI-INSTRUCTIONS.md Web Interface table links to the new README section
- [x] #5 npx biome check . produces no new errors vs main (pre-existing package.json drift, not touched here)
- [x] #6 Docs-only change; no code or tests touched — bun test validation deferred to CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Draft the Running as a Service section covering systemd-user, launchd, and Windows (NSSM/Scheduled Task)
2. Insert after the Web Interface section in README.md
3. Add a cross-reference row in CLI-INSTRUCTIONS.md Web Interface table
4. Run bun run check . and bun test
5. Commit as BACK-414 and open PR against upstream main
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a "Running as a Service" top-level section to README.md right after the Web Interface section, covering three OS recipes for keeping `backlog browser --no-open` alive and auto-starting on boot:
- Linux / WSL2 via a systemd user unit + `loginctl enable-linger`
- macOS via a launchd LaunchAgent plist
- Windows via Scheduled Task (PowerShell) and NSSM

Also added a cross-reference note under the Web Interface table in CLI-INSTRUCTIONS.md pointing at the new section.

No source code touched. The pre-existing `bun run check .` failure on `package.json` is inherited from main and out of scope (same precedent as BACK-413).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
