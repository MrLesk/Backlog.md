---
id: task-217.02
title: 'Sequences web UI: list sequences'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:13'
updated_date: '2025-08-26 20:30'
labels:
  - sequences
dependencies: []
parent_task_id: task-217
---

## Description

Add a Sequences page that fetches data from the server and displays sequences vertically with clear labeling.

## Acceptance Criteria
<!-- AC:BEGIN -->
 - [x] #1 Sequences page reachable from navigation
 - [x] #2 Displays sequences from server with task titles
 - [x] #3 Handles empty/large datasets gracefully
 - [x] #4 Page renders Unsequenced bucket first (when present), then numbered sequences
 - [x] #5 Handles large/empty datasets; no layout jitter when Unsequenced is absent
<!-- AC:END -->
