---
id: BACK-603
title: Align create and draft flag handling with the edit path
status: To Do
assignee: []
created_date: '2026-08-08 15:56'
labels: []
dependencies: []
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The create path diverges from the hardened edit path: repeated -l/--labels flags keep only the last value on task create and draft create (edit collects all of them), and empty --dep/--ref values are silently accepted or dropped on create where edit rejects them with a clear validation error. There is also a dependsOn/dep alias quirk on the create path. Each of these was confirmed 2-3 times independently across the Aug 2026 review rounds. Align create and draft with the edit path by reusing the same shared validation and collection helpers instead of duplicating logic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Repeated label flags on task create and draft create collect all values, matching edit
- [ ] #2 Empty --dep and --ref values on create and draft fail with the same clear validation error as edit
- [ ] #3 Create, draft and edit share the same helpers for these validations (no duplicated logic)
- [ ] #4 Tests cover the create and draft parity cases
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
