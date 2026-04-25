---
id: BACK-426
title: Fix in-document markdown hash links
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - markdown
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/529'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #529: make links to headings within rendered documents/tasks work reliably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rendered markdown headings receive stable deterministic IDs.
- [ ] #2 Links using #anchor navigate within the rendered document without leaving the current document context unexpectedly.
- [ ] #3 Tests or browser verification cover a document with multiple heading links.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
