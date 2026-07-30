---
id: BACK-260
title: 'Web UI: Include completed records in All Tasks'
status: To Do
assignee:
  - '@codex'
created_date: '2025-09-07 19:42'
updated_date: '2026-07-30 17:10'
labels:
  - web-ui
  - filters
  - ui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/825'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the existing All Tasks page so completed work remains discoverable after the canonical completion or cleanup workflow moves it into backlog/completed.

Completed-directory tasks are hidden by default to keep the normal task list focused. An explicit Include completed filter lets users add those records to All Tasks, where existing filters continue to narrow the combined results. This source filter is distinct from task status: active tasks with the terminal status remain active tasks, while completed means the record is stored in backlog/completed.

Browser search must find completed-directory tasks by ID or keyword and open their existing task details. The active Kanban board remains unchanged, and records in backlog/archive/tasks are excluded.

This task does not add multi-status selection, which remains owned by BACK-424.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All Tasks hides records from backlog/completed by default.
- [ ] #2 All Tasks provides an explicit Include completed filter that, when enabled, adds completed-directory records to the active task results.
- [ ] #3 The filter distinguishes storage source from configured status: active terminal-status tasks remain visible under normal active-task and status-filter behavior, while only records from backlog/completed are controlled by Include completed.
- [ ] #4 Records from backlog/archive/tasks are never included by this filter.
- [ ] #5 Existing status, excluded-status, priority, milestone, and label filters apply consistently to the combined active and completed result set.
- [ ] #6 The Include completed state is represented in URL query parameters, restores on reload and browser navigation, and combines without discarding other active filter parameters.
- [ ] #7 Clearing filters restores the default state with completed-directory tasks hidden.
- [ ] #8 Browser search by task ID or keyword includes matching completed-directory tasks even when All Tasks is using its default hidden state.
- [ ] #9 Selecting a completed task from All Tasks or browser search opens its existing task details through the current task-detail route, including after direct URL reload.
- [ ] #10 The Kanban board continues to exclude completed-directory tasks by default.
- [ ] #11 Empty, loading, and error states remain understandable when completed records are included.
- [ ] #12 Tests cover default hiding, enabling and clearing the filter, URL restoration, interaction with existing filters, completed-task search, archive exclusion, and unchanged board behavior.
<!-- AC:END -->
