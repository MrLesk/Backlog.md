---
id: BACK-428
title: Document npx backlog.md usage
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - documentation
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/566'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #566: clarify that one-off npm execution uses the backlog.md package name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README examples show the correct npx backlog.md command form where one-off execution is documented.
- [ ] #2 Global install and direct backlog command examples remain clearly separated.
- [ ] #3 Documentation checks or grep verification confirm no misleading npx backlog examples remain.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
