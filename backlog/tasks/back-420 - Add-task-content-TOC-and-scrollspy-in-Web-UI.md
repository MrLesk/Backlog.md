---
id: BACK-420
title: Add task content TOC and scrollspy in Web UI
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-05-17 20:20'
labels:
  - web-ui
  - content-viewer
  - enhancement
milestone: m-8
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/405'
  - BACK-260
priority: low
ordinal: 150000
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This task is a sub-concern of BACK-260 (Web UI: Add filtering to All Tasks view). Implement as part of BACK-260 or track as a sub-item under it. The TOC/scrollspy work applies to the same task content area that BACK-260 surfaces.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
