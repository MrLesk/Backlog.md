---
id: BACK-418
title: Publish supported container runtime for backlog browser
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - packaging
  - docker
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/335'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #335: provide an official containerized way to run the browser UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A supported Dockerfile or image can run backlog browser against a mounted project directory.
- [ ] #2 The container path documents port, volume, and no-open behavior.
- [ ] #3 The release or publishing path for the image is documented or intentionally deferred.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
