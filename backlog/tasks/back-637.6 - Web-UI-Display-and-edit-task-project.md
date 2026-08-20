---
id: BACK-637.6
title: 'Web UI: Display and edit task project'
status: To Do
assignee: []
created_date: '2026-08-20 16:21'
labels: []
dependencies:
  - BACK-637.1
parent_task_id: BACK-637
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a ProjectBadge component (mirroring TaskTypeBadge.tsx). Thread config.projects through src/web/App.tsx as availableProjects. Add project query params to src/web/lib/api.ts. Add project filtering/column/badge to TaskList.tsx, Board.tsx/BoardPage.tsx, TaskCard.tsx, DraftsList.tsx, and a project <select> (with a 'No Project' empty option) to TaskDetailsModal.tsx next to the priority select, including form state, dirty check, and save payload. Mirror priority's known clearing gap on the web (project === '' -> undefined -> dropped by JSON.stringify -> server 'project' in updates guard is false -> clearing from web silently no-ops) rather than fixing it -- that gap is pre-existing and out of scope here. Update src/web/components/SideNavigation.tsx's active-filter indicator to include project. All project UI must render nothing when config.projects is empty.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task list, board, and card views show a project badge when set
- [ ] #2 Task list and board have a project filter control that updates the URL, matching the priority filter's pattern
- [ ] #3 Task detail modal has a project select with a 'No Project' option and configured project choices
- [ ] #4 All project UI (badge, filter, select) is absent when config.projects is empty
- [ ] #5 Existing web tests (web-task-types.test.tsx equivalents) pass; new coverage added for project display/filtering
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
