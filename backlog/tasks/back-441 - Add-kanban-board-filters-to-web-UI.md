---
id: BACK-441
title: Add kanban board filters to web UI
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 22:13'
labels:
  - feature
  - web
  - board
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/574'
  - BACK-260
  - BACK-361
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add focused filtering controls to the Web UI kanban board so users can narrow visible cards by assignee, label, and priority. This is the workflow task for PR #574; it is related to the broader filter work referenced there, but the accepted scope is limited to board-level web UI filtering with URL persistence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The board view exposes assignee, label, and priority filters when matching task metadata exists.
- [ ] #2 Selected filters are applied together with AND semantics and continue to respect existing board lane/milestone behavior.
- [ ] #3 Filter state is reflected in URL query parameters and survives reload/navigation.
- [ ] #4 A clear action resets all board filters and removes their URL query parameters.
- [ ] #5 Browser verification covers assignee, label, priority, combined filters, reload persistence, and clearing filters.
- [ ] #6 Existing board interactions are not regressed by the filter controls.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
