---
id: BACK-424
title: Support multiple status filters in Web task lists
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - filters
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/502'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #502: allow filtering Web UI task lists by more than one status at the same time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Web task list can filter by multiple selected statuses.
- [ ] #2 Filter state is reflected in the URL or existing persisted filter state.
- [ ] #3 Clear/reset behavior returns the list to the unfiltered status set.
- [ ] #4 Tests cover multi-status selection and reset.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
