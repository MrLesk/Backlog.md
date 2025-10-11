---
id: task-287.05
title: 'Phase 5: Auto-Check & Web UI Integration'
status: To Do
assignee: []
created_date: '2025-10-11 05:03'
labels:
  - jira
  - ui
  - auto-check
  - phase5
dependencies: []
parent_task_id: task-287
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add automatic remote checking on local edits (5-minute guard) and web UI components for sync status. Includes API routes, React components, and file watcher integration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes
- [ ] #2 bun run check (lint/format) passes
- [ ] #3 API endpoints respond with 200
- [ ] #4 React components render without errors
- [ ] #5 Edit a Jira-linked task file, wait 6 minutes, auto-check triggers
- [ ] #6 Web UI (backlog browser) shows Jira badge on linked tasks
- [ ] #7 Click Pull button in web UI updates task
- [ ] #8 Edit task in web UI, click Push button updates Jira
<!-- AC:END -->
