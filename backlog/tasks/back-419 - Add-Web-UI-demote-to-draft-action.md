---
id: BACK-419
title: Add Web UI demote-to-draft action
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - drafts
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/405'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track part of GitHub issue #405: expose demote-to-draft from the Web UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task detail UI exposes a demote-to-draft action when applicable.
- [ ] #2 The action uses the existing demote semantics and refreshes the UI after success.
- [ ] #3 A confirmation or equivalent guard prevents accidental demotion.
- [ ] #4 Tests cover the Web UI/API path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
