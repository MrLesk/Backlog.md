---
id: BACK-470.3
title: Add task comments to server API and Web UI
status: Done
assignee:
  - '@codex'
created_date: '2026-05-31 17:32'
updated_date: '2026-05-31 17:59'
labels:
  - comments
  - server
  - web-ui
dependencies:
  - BACK-470.1
documentation:
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/test/server-search-endpoint.test.ts
  - src/test/web-task-details-modal-final-summary.test.tsx
parent_task_id: BACK-470
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add browser support for task comments using the same shared task model as CLI and MCP. The Web UI should display comments on task detail and allow appending a new comment for local editable tasks without requiring a full task edit flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server task responses include comments and a local editable task can receive a new comment through the task update API.
- [x] #2 Web task detail displays comments in chronological order with readable author, timestamp, and markdown-rendered body.
- [x] #3 Web users can add a comment from the task detail view without switching to full edit mode.
- [x] #4 Read-only cross-branch tasks display comments but do not allow comment submission.
- [x] #5 Web/API tests cover comment display, append behavior, refresh behavior, and read-only disabling.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add server update payload handling for comment appends via the existing task update endpoint.
2. Extend Web API typing through the shared Task model.
3. Add a comments section to the task modal preview that renders markdown comments and allows local editable tasks to submit a new comment without entering full edit mode.
4. Add server/Web tests for display, append, refresh, and read-only state where practical.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added server update payload handling, Web API typing, and TaskDetailsModal comment display/add controls. Manual browser verification at `http://localhost:6421` confirmed the Comments section, empty state, textarea, Add comment action, and no console/page errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server API responses include comments and the Web task details modal displays comments and lets local editable tasks append new comments without switching into full edit mode. Cross-branch read-only tasks keep the form hidden.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
