---
id: BACK-433
title: Make task edit preserve unrelated file details
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:15'
labels:
  - cli
  - core
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/603'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #603: editing one field should not rename, recase, or otherwise rewrite unrelated task file details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Editing a single task field preserves the task ID casing, filename identity, and unrelated metadata/content.
- [ ] #2 A label-only edit does not inject or remove unrelated markers or sections.
- [ ] #3 Regression tests cover the issue's task create/edit script or an equivalent fixture.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
