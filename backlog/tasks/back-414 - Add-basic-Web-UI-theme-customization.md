---
id: BACK-414
title: Add basic Web UI theme customization
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/194'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #194: allow users to customize the Web UI theme without changing the default appearance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A project/user theme hook can override Web UI styling without editing bundled source files.
- [ ] #2 The default Web UI theme remains unchanged for existing users.
- [ ] #3 The customization path is documented and covered by a browser or unit smoke check.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
