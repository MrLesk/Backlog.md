---
id: BACK-806
title: Validate browser requests and constrain settings updates
status: Done
assignee:
  - '@codex'
created_date: '2026-11-17T07:14:00Z'
updated_date: '2026-11-17T21:31:00Z'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/web/components/Settings.tsx
  - src/test/server-hostname.test.ts
  - src/web/lib/api.ts
modified_files:
  - src/test/server-hostname.test.ts
  - src/server/index.ts
  - src/web/components/Settings.tsx
  - src/test/server-tasks-spa-fallback.test.ts
  - src/test/web-settings-save.test.tsx
priority: high
type: bug
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The browser server accepts requests addressed to names outside its configured listener, and its settings endpoint can replace fields the UI does not edit. Keep browser requests within the selected local origin and restrict HTTP settings writes to user-editable fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unexpected Host authorities are rejected before browser routes or WebSocket upgrades can read or change project data.
- [x] #2 Cross-origin writes and WebSocket upgrades are rejected; legitimate local names and configured browser addresses continue to work.
- [x] #3 Browser settings saves update only fields offered in Settings and preserve command-bearing and other non-UI fields already on disk.
- [x] #4 HTTP regression tests cover rejected requests, allowed requests, and preserved settings.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one request-authority policy from the effective listening host and port; apply it to every API/data route and the WebSocket fallback before handlers run. Preserve localhost, IPv4/IPv6 and explicit wildcard-host flows without allowing arbitrary DNS names. 2. Limit browser config PUT to the fields shown by Settings, retaining all other stored values; remove the command-bearing editor control from Settings. 3. Prove rejected attacker Host and Origin, accepted normal requests, rejected WebSocket upgrade, and ignored command-setting input with HTTP tests. Run focused tests, types, Biome, build and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Host and Origin checks cover native API and asset routes plus WebSocket upgrades. Browser settings updates merge validated UI fields with the latest saved config. HTTP and DOM regressions pass. CI platform profile: 536 pass. Full source profile: 3352 pass, 13 skip, one interactive viewer failure also reproduced on untouched origin/main. Static HTML routes still serve the app shell on unexpected hosts; they expose no project data.

Review round approved by Alex on 2026-11-17. The Host check no longer compares the port, so a forwarded port works. Loopback names are accepted on every listener, including a wildcard one. Every route with handlers is guarded and only the static app shell is skipped. Number checks for settings match backlog config set (positive column width, non-negative ID padding) instead of the Settings input hints. The server holds the only list of browser-editable fields; Settings sends its config and shows what the server saved, so src/web/lib/api.ts is unchanged from main. Checks after the round: types, Biome, 223 server tests across 29 files, and the web DOM tests that use the server or Settings.

Alex decided on 2026-11-17 to remove the Task Resolution Strategy field from browser Settings: config.yml never stored it, so the field saved nothing. The server no longer accepts it from the browser. Core still reads the in-memory value with its existing default. Checked the Settings page in a browser: both cards that lost a field lay out cleanly and the page loads through localhost.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Protected project-data routes and WebSocket upgrades from untrusted browser origins. Restricted Settings writes to editable fields and preserved other config values. Verified with HTTP and DOM tests, types, Biome, build, and 536 passing platform tests. The full source profile has one pre-existing interactive viewer failure reproduced on origin/main.
<!-- SECTION:FINAL_SUMMARY:END -->
