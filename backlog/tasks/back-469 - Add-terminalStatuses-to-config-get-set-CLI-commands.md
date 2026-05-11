---
id: BACK-469
title: Add terminalStatuses to config get/set CLI commands
status: Done
assignee:
  - '@claude'
created_date: '2026-05-06 22:14'
updated_date: '2026-05-11 20:25'
labels:
  - bugfix
dependencies:
  - BACK-465
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The terminalStatuses config key was introduced in BACK-465 but not registered in the config get/set switch statements in src/cli.ts. Users cannot read or write this value via CLI.\n\nFiles to fix:\n- src/cli.ts: config get switch (~line 3452) — add case 'terminalStatuses'\n- src/cli.ts: config set switch (~line 3643) — add case 'terminalStatuses' (comma-separated string input → string[])
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 config get terminalStatuses returns the value from backlog.config.yml
- [x] #2 config set terminalStatuses 'Done,Closed' persists the array to config
- [x] #3 config get terminalStatuses prints empty/nothing when key not set
- [x] #4 Available keys error message updated to include terminalStatuses
- [x] #5 bun test: no new failures
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
3 files changed, 2 bugs discovered:

| File | Change |
|------|--------|
| src/cli.ts | config get + config set: case terminalStatuses, both available-keys messages |
| src/file-system/operations.ts | serializeConfig: terminal_statuses line was missing; saveConfig: [] → undefined normalization |
| src/test/config-commands.test.ts | 4 new tests (set+get, empty default, array roundtrip, error case) |

Bugs discovered during implementation:
- serializeConfig did not write terminal_statuses back to YAML (missing line in lines array)
- saveConfig cached empty array [] instead of normalizing to undefined → roundtrip returned [] instead of undefined

Known limitation: config set terminalStatuses "" not possible (CLI requires mandatory argument) — to clear, edit config file directly.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
