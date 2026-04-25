---
id: BACK-417
title: Improve Web UI content viewer sizing and mode persistence
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - editor
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/291'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #291: improve the content viewer/editor ergonomics in the Web UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Long content has a wider responsive viewing/editing surface without layout overlap.
- [ ] #2 The chosen view/edit mode is persisted appropriately for the user/session.
- [ ] #3 Browser verification or automated coverage confirms the modal remains usable on desktop and mobile widths.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
