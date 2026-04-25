---
id: BACK-423
title: Add folder grouping for docs in Web UI
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - docs
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/488'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #488: make documentation easier to navigate when docs are organized into folders or path groups.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Documentation list groups documents by folder or comparable path/type grouping.
- [ ] #2 Users can expand and collapse groups without losing access to flat docs.
- [ ] #3 Existing document create/view/edit behavior continues to work for ungrouped docs.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
