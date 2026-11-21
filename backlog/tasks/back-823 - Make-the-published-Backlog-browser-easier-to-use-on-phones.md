---
id: BACK-823
title: Make the published Backlog browser easier to use on phones
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T21:50:00Z'
updated_date: '2026-11-21T22:28:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1247
  - src/web/components/Layout.tsx
  - src/web/components/Board.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/MilestoneTaskRow.tsx
  - src/web/App.tsx
  - src/web/utils/urlHelpers.ts
modified_files:
  - src/web/components/RecordIndex.tsx
  - src/web/components/Board.tsx
  - src/web/components/Layout.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/Navigation.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/Modal.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/MilestoneTaskRow.tsx
  - src/web/components/MilestonesPage.tsx
  - src/test/web-task-detail-deeplink.test.tsx
  - src/web/App.tsx
  - src/web/utils/urlHelpers.ts
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
- [x] #4 A phone reader can swipe across statuses in either board grouping, open a card, and return to the same board position.
- [x] #5 The phone task list opens on task rows, task status and assignee are visible near the title, and milestone rows show readable task titles.
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

5. Revise the phone reading flow from hands-on feedback. Use the navigation icon and one horizontal board across statuses. Keep task-list filters and sorting available on demand, show task status and owner near its title, and give milestone rows room for task titles. Verify position when returning from a task and update the same comparison link.

6. Address the review findings for opening a full page from a scrolled page and for showing the current document or decision in navigation. Preserve the board and list positions while a task dialog is open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built the v1.57.1 baseline and responsive branch as separate read-only previews with identical sample data. Verified board status, filters, task list, and document and decision navigation at 365px, the drawer and board at 768px, and the sidebar and columns at 1440px. Confirmed the live narrow board retains edit controls and all status columns. Types, Biome, and 166 focused tests passed. Ready for phone review.

Verified the updated reading flow in the published sample at 365 px. Both status groupings scroll sideways, and closing a card or using Back restores the same column and reading position. On the task list, the first row moved from 456 px down to 169 px. On the sample task, the assignee moved from 1,897 px down to 126 px. Milestone task titles wrap. Verified filters, sorting, navigation, documents, decisions, statistics, and settings, and checked the nine published page types at 768 and 1440 px. The editable browser still exposes its edit and drag controls. Both LAN previews serve identical project data. Types, Biome, 395 browser and grouping tests and 22 CLI tests passed. Awaiting Alex’s phone review.

Alex approved the revised phone preview and requested pull request review.

PR review found that the task list could inherit the board’s scroll position and that index links did not mark the selected document or decision in the drawer. Switching full pages now starts at the top. Verified at 365 × 640 that closing a task preserves both board offsets and using Back preserves the list position. Verified active links and scrolling between long documents and decisions. Types, Biome and all 417 focused tests pass with the fixes.

The shared record links also keep doc-new and decision-new distinct from the New Document and New Decision commands. Verified through both read-only and writable views.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
At phone widths the published browser keeps Kanban statuses side by side and puts the first task, its status and its assignee within reach. The shared navigation also exposes documents and decisions directly. Verified the reading flow at 365, 768 and 1440 px. Type checks, Biome and 417 focused tests passed. Alex approved the phone preview.
<!-- SECTION:FINAL_SUMMARY:END -->
