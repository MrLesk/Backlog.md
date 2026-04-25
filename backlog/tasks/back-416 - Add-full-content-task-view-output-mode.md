---
id: BACK-416
title: Add full-content task view output mode
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - cli
  - task-view
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/289'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #289: add an output mode for viewing full task content when --plain is too compact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A task view option outputs the full markdown content or all structured sections without truncation.
- [ ] #2 Existing plain output remains stable unless explicitly documented otherwise.
- [ ] #3 Tests cover tasks containing markdown headings inside content sections.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
