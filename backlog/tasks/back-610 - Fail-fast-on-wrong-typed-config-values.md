---
id: BACK-610
title: Fail fast on wrong-typed config values
status: To Do
assignee: []
created_date: '2026-08-08 21:52'
labels: []
dependencies: []
ordinal: 249000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to BACK-606 by owner decision (Alex, 2026-08-08: "strict"). Wrong-typed but syntactically valid YAML config values, for example statuses: To Do (a scalar where a list belongs) or default_assignee: {name: "@alice"}, are currently silently ignored with defaults applied. They must instead abort startup with the same clear error shape BACK-606 established ("Backlog could not start because <file> has an invalid value for <key>: ..."). BACK-606 left two hooks for this: the return-undefined branches in parseConfigListValue in src/file-system/operations.ts become throws, and the interim parity check in src/utils/config-watcher.ts (marked with a pending-owner-decision comment) becomes removable because the parser then rejects wrong types for every surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A wrong-typed value for any list config key aborts startup with the "Backlog could not start because" error naming the key
- [ ] #2 The config watcher rejects wrong-typed edits via the shared parser; the interim per-key parity check is removed
- [ ] #3 Valid configs and the malformed-YAML error paths from BACK-606 are unchanged
- [ ] #4 Tests cover a wrong-typed value per list key at startup and via the watcher
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
