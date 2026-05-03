---
id: BACK-441
title: Add kanban board filters to web UI
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 22:13'
updated_date: '2026-05-03 12:45'
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
- [x] #1 The board view exposes assignee, label, and priority filters when matching task metadata exists.
- [x] #2 Selected filters are applied together with AND semantics and continue to respect existing board lane/milestone behavior.
- [x] #3 Filter state is reflected in URL query parameters and survives reload/navigation.
- [x] #4 A clear action resets all board filters and removes their URL query parameters.
- [x] #5 Browser verification covers assignee, label, priority, combined filters, reload persistence, and clearing filters.
- [x] #6 Existing board interactions are not regressed by the filter controls.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #574: added board-level assignee, label, and priority filters to the Web UI with URL persistence and a clear action. Rebased the contributor branch onto current main, regenerated Tailwind CSS, added focused board-filter tests including filtered milestone lane metadata, addressed Codex review feedback, verified the behavior in a real Chrome browser, and confirmed all GitHub checks and Codex review passed before merge.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
