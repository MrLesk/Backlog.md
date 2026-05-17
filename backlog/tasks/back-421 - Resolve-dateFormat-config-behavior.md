---
id: BACK-421
title: Resolve dateFormat config behavior
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-05-17 20:10'
labels:
  - config
  - bug
  - cleanup
milestone: m-13
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/461'
priority: medium
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #461: dateFormat/date_format is configurable but inconsistently applied.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The project either honors dateFormat consistently or deprecates/removes it from the public config surface.
- [ ] #2 CLI, Web UI, settings, and docs agree on the supported date behavior.
- [ ] #3 Tests cover the chosen behavior and any legacy fallback.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
