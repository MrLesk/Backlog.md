---
id: BACK-823
title: Make the published Backlog browser easier to use on phones
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-21T21:50:00Z'
updated_date: '2026-11-21T21:56:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1247
  - src/web/components/Layout.tsx
  - src/web/components/Board.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
modified_files:
  - src/web/components/RecordIndex.tsx
  - src/web/components/Board.tsx
  - src/web/components/Layout.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/Navigation.tsx
  - src/web/components/TaskList.tsx
type: enhancement
ordinal: 420000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A reader checking project progress from a phone needs to reach tasks and related material. At 365px the fixed sidebar leaves too little room to browse, and the task views are wider than the remaining page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At 365px the board and task list are readable without a fixed sidebar taking up the content width.
- [x] #2 A reader can navigate between the board, task list, documents and decisions, and use the existing board filters.
- [x] #3 Tablet and desktop layouts preserve the existing browser views and edit controls, and the export remains read-only.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Give narrow screens the full reading width by using the existing navigation in a drawer.
2. Make board status and task list details usable at 365px with the existing task views and filters.
3. Make documents and decisions reachable and readable on a phone.
4. Verify the phone, tablet, and desktop flows, and serve independent before and after exports for comparison.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built the v1.57.1 baseline and responsive branch as separate read-only previews with identical sample data. Verified board status, filters, task list, and document and decision navigation at 365px, the drawer and board at 768px, and the sidebar and columns at 1440px. Confirmed the live narrow board retains edit controls and all status columns. Types, Biome, and 166 focused tests passed. Ready for phone review.
<!-- SECTION:NOTES:END -->
