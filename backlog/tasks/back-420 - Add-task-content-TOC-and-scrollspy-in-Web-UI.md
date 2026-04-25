---
id: BACK-420
title: Add task content TOC and scrollspy in Web UI
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - web-ui
  - content-viewer
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/405'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track part of GitHub issue #405: add a table of contents and active-heading behavior for long task content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Markdown headings in task content produce stable in-page anchors.
- [ ] #2 Long task content can show a table of contents with active-heading indication.
- [ ] #3 The TOC remains usable without obscuring content on narrow screens.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
