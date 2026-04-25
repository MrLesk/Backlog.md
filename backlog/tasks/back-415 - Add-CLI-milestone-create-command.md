---
id: BACK-415
title: Add CLI milestone create command
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - cli
  - milestones
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/232'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #232: provide a public CLI path for creating milestones, using the current milestone file storage model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A CLI milestone create command creates a milestone using the current milestone storage model.
- [ ] #2 Duplicate milestone names or IDs are rejected with a clear error.
- [ ] #3 Created milestones appear in milestone list and existing milestone-aware views.
- [ ] #4 Tests cover successful creation and duplicate validation.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
