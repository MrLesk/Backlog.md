---
id: BACK-818
title: Export the browser as a read-only static site
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T12:46:00Z'
updated_date: '2026-11-21T13:03:00Z'
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
- [x] #3 The default export includes tasks, milestones, documents, decisions, and statistics and omits drafts and archives. A tasks-only option omits the other collections from the generated data.
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
1. Add a CLI export that packages the existing browser bundle and a snapshot from the checked-out Backlog project. Exclude drafts and archived records, and offer task-only output.
2. Give the shared browser a snapshot data source and a single editing decision. Keep the existing read pages, links, search, and view controls. Remove redundant write callbacks while wiring up the read-only mode.
3. Verify source and packaged exports on a plain static host, including nested paths and direct links. Check live behavior, cognitive complexity, and touched code with codehygiene.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The CLI captures the current checkout and publishes the same browser bundle with embedded data. Fragment URLs keep direct links portable across mount paths. The snapshot contains only IDs and statuses for referenced archived dependencies, preserving readiness without making those records browseable. Linked assets are selected from published Markdown and removed from a narrower re-export when no longer referenced.

Chrome checks passed against source and compiled exports at the site root and a nested URL, including direct links, read controls, no Backlog API requests, archive readiness, assets, and tasks-only re-export. Verified editing and creation in the live browser and existing Markdown export tests. The two ContentStore watcher tests that timed out in the parallel pass passed in isolation. cccc parsed the changed source and tests; codehygiene ran on changed lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a CLI export that packages the shared browser and a read-only snapshot. It preserves browsing and strips write controls, supports tasks-only output, and includes linked assets from published records. Types, Biome, focused tests, and browser checks passed. Two watcher tests timed out only in the parallel run and passed in the focused ContentStore suite.
<!-- SECTION:FINAL_SUMMARY:END -->
