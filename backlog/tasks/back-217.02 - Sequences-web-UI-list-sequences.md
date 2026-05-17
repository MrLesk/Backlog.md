---
id: BACK-217.02
title: 'Sequences web UI: list sequences'
status: To Do
assignee: []
created_date: '2025-08-23 19:13'
updated_date: '2026-05-17 20:27'
labels:
  - sequences
milestone: m-10
dependencies:
  - BACK-474
parent_task_id: BACK-217
priority: low
ordinal: 155000
---

## Description

Add a Sequences page that fetches data from the server and displays sequences vertically with clear labeling.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sequences page reachable from navigation
- [ ] #2 Displays sequences from server with task titles
- [ ] #3 Handles empty/large datasets gracefully
- [ ] #4 Page renders Unsequenced bucket first (when present), then numbered sequences
- [ ] #5 Handles large/empty datasets; no layout jitter when Unsequenced is absent
<!-- AC:END -->
