---
id: BACK-825
title: Accept browser requests for the selected hostname
status: Done
assignee:
  - '@codex'
created_date: '2026-11-22T13:32:00Z'
updated_date: '2026-11-22T13:35:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1251
  - src/cli.ts
  - src/server/index.ts
modified_files:
  - src/test/cli-browser-port.test.ts
  - src/server/index.ts
  - src/cli.ts
  - src/test/server-hostname.test.ts
type: bug
ordinal: 421000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a user opens the browser through a name set with --host or browser_hostname, the page loads but its API requests receive HTTP 403. The CLI lost the chosen name when it looked up the listening address.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The task list loads through a hostname supplied by --host or saved in browser_hostname.
- [x] #2 Port selection and the listener use the same resolved address, and unrelated names remain rejected.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Keep the selected name and its resolved address together through browser startup. Extend the existing CLI integration coverage for a named host, reproduce the failure, and verify both the command-line and saved setting.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Browser startup now keeps the selected hostname and the address from one lookup. The port check and listener use that address, and the server accepts the original name. Both CLI regression cases returned 403 before the fix. The compiled CLI served the expected task through backlog.localhost with either setting and returned 403 for an unrelated name. All 64 focused tests passed, along with type and formatting checks.
<!-- SECTION:FINAL_SUMMARY:END -->
