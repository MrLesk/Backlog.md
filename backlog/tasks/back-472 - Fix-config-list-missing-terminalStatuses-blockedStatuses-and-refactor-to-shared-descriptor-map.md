---
id: BACK-472
title: >-
  Fix config list missing terminalStatuses/blockedStatuses and refactor to
  shared descriptor map
status: In Review
assignee:
  - '@claude'
created_date: '2026-05-07 15:22'
updated_date: '2026-05-07 15:36'
labels: []
dependencies: []
priority: high
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
config list did not display terminalStatuses or blockedStatuses even when set in config.yml. config get worked correctly for terminalStatuses but blockedStatuses had no get/set support at all. Root cause: config list was a hardcoded sequence of console.log calls disconnected from config get/set. Fix: introduce CONFIG_DESCRIPTORS map as single source of truth; config get dispatches through it, config list loops over it. blockedStatuses added to get/set/list. New tests added for blockedStatuses and config list conditional display.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 config list shows terminalStatuses when set
- [x] #2 config list shows blockedStatuses when set
- [x] #3 config get blockedStatuses works
- [x] #4 config set blockedStatuses works
- [x] #5 CONFIG_DESCRIPTORS is single source of truth for get/list/error messages
- [x] #6 all config-commands tests pass (15 tests)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Files changed: src/cli.ts, src/test/config-commands.test.ts
Commit: ebe7108

- Introduced CONFIG_DESCRIPTORS map (type ConfigDescriptor) before config command group in cli.ts
- config get switch replaced by descriptor lookup (getValue function)
- config list hardcoded console.log sequence replaced by loop over listEntry functions
- config set default error message now derives available keys from CONFIG_DESCRIPTORS
- Added blockedStatuses case to config set switch
- Added 3 new tests: blockedStatuses set/get round-trip, blockedStatuses empty string when unset, config list conditional display for both terminal/blocked statuses
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
config list now shows terminalStatuses and blockedStatuses when set. blockedStatuses is fully supported in get/set/list. Root cause was a hardcoded console.log sequence in config list disconnected from the get/set implementations. Fixed with CONFIG_DESCRIPTORS map as single source of truth — future fields only need to be added to the map; get and list pick them up automatically. Commit: ebe7108
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
