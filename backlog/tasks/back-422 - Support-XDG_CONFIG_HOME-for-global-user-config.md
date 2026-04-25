---
id: BACK-422
title: Support XDG_CONFIG_HOME for global user config
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - config
  - xdg
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/464'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #464: global user config should respect the XDG Base Directory Specification where applicable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Global user config reads and writes under XDG_CONFIG_HOME when it is set.
- [ ] #2 Existing legacy config paths continue to work or migrate with documented precedence.
- [ ] #3 Tests cover XDG and fallback path resolution.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
