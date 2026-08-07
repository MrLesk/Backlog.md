---
id: BACK-583
title: Implement defaultAssignee
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/849'
priority: medium
type: bug
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #849. ADVANCED-CONFIG.md line 23 documents a `defaultAssignee` setting, but `config get` and `config set` reject it as an unknown key (src/cli.ts:4417-4420 and src/cli.ts:4630-4633) and no non-test code reads it. The setting is documented but entirely inert.

Most of the plumbing already exists: the type (src/types/index.ts:300), YAML parse and serialize (src/file-system/operations.ts:1504-1505 and src/file-system/operations.ts:1622), and the watcher key (src/utils/config-watcher.ts:33).

Maintainer decision: this is a bug in the implementation, not in the documentation. Implement the documented behavior rather than deleting the doc entry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog config get defaultAssignee` returns the configured value
- [ ] #2 `backlog config set defaultAssignee <value>` stores the value
- [ ] #3 `backlog config list` includes defaultAssignee
- [ ] #4 `backlog task create` with no -a applies the configured defaultAssignee
- [ ] #5 An explicit -a on `task create` overrides the configured defaultAssignee
- [ ] #6 ADVANCED-CONFIG.md accurately describes the shipped behavior
- [ ] #7 Tests cover both the apply and the override paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
