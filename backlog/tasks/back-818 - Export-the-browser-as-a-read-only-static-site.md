---
id: BACK-818
title: Export the browser as a read-only static site
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T12:46:00Z'
updated_date: '2026-11-21T14:50:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1220
  - src/cli.ts
  - src/web/App.tsx
  - src/web/lib/api.ts
  - src/server/index.ts
modified_files:
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/Board.tsx
  - src/web/lib/browser-snapshot.ts
  - src/web/contexts/BrowserAccessContext.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/DependencyInput.tsx
  - src/core/search-service.ts
  - src/web/App.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/MilestoneTaskRow.tsx
  - src/test/web-task-acceptance-progress.test.tsx
  - src/test/web-task-types.test.tsx
  - src/test/web-task-project.test.tsx
  - src/test/web-task-card-dates.test.tsx
  - src/test/web-task-details-modal-acceptance-criteria.test.tsx
  - src/test/web-task-column-sort.test.tsx
  - src/web/hooks/useHealthCheck.tsx
  - src/web/contexts/HealthCheckContext.tsx
  - src/web/main.tsx
  - src/web/utils/version.ts
  - src/web/components/MilestonesPage.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/Settings.tsx
  - src/server/browser-export.ts
  - src/web/components/SideNavigation.tsx
  - src/cli.ts
  - src/web/lib/api.ts
  - src/web/components/MermaidMarkdown.tsx
  - README.md
  - src/utils/status-filter.ts
  - src/utils/status.ts
  - src/utils/task-record-index.ts
  - src/utils/dependency-graph.ts
  - src/utils/readiness.ts
  - src/core/task-detail.ts
  - src/web/components/DependencyGraphSection.tsx
  - src/core/statistics.ts
  - src/server/browser-export-assets.ts
  - src/test/cli-doc-decision-board.test.ts
type: feature
ordinal: 416000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teams need to share a browsable Backlog.md snapshot with stakeholders on static hosting. Reuse the existing browser views and retain controls that only affect reading or navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CLI exports a self-contained static site that runs at the site root or a nested URL without a Backlog.md server, with shareable record links.
- [x] #2 The export retains existing browsing, search, filters, sorting, and details for published records. Write controls and write shortcuts are absent.
- [x] #3 With no section flags the export includes all supported content and omits drafts and archives. With section flags it includes only the selected collections, with omitted sections absent from the snapshot, search, and navigation.
- [x] #4 The existing live browser and Markdown board export keep their supported behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 Verify the source and packaged CLI and exercise the exported site on a static host
- [x] #5 Check cognitive complexity and run codehygiene for touched code
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Select tasks, docs, decisions, and milestones independently in the CLI and write only selected data. Use snapshot collection presence to control available views.
2. Keep task statistics with tasks, open a published view on direct entry, and make excluded sections unavailable. Preserve selective attachment cleanup and the full export default.
3. Verify the flag combinations, compiled and source exports, navigation, search, and re-export behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The CLI captures the current checkout and publishes the same browser bundle with embedded data. Fragment URLs keep direct links portable across mount paths. The snapshot contains only IDs and statuses for referenced archived dependencies, preserving readiness without making those records browseable. Linked assets are selected from published Markdown and removed from a narrower re-export when no longer referenced.

Chrome checks passed against source and compiled exports at the site root and a nested URL, including direct links, read controls, no Backlog API requests, archive readiness, assets, and tasks-only re-export. Verified editing and creation in the live browser and existing Markdown export tests. The two ContentStore watcher tests that timed out in the parallel pass passed in isolation. cccc parsed the changed source and tests; codehygiene ran on changed lines.

Section flags select tasks, documents, decisions, and milestones independently. The snapshot includes only the selected collections, and the shared browser uses collection presence to show routes, navigation, and search. Task statistics follow tasks. Read-only Settings is available in every export. The source and compiled CLIs passed all 15 flag combinations and the default. Headless Chrome verified nested links, expanded and collapsed sidebars, search, and omitted-route fallback. Re-exporting removed excluded record data and obsolete attachments while keeping host-owned files. Focused tests, type checking, and Biome passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The CLI exports the shared browser as a read-only static site. It publishes all supported collections by default or the exact set named by --tasks, --docs, --decisions, and --milestones. The selected data determines which sections appear in the sidebar, routes, and search. Verified the selection combinations in the source and compiled CLIs, and tested the shared UI in Chrome.
<!-- SECTION:FINAL_SUMMARY:END -->
