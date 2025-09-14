---
id: task-265
title: Add --no-git init mode
status: To Do
assignee:
  - '@pjsample'
created_date: '2025-09-14 13:58'
labels:
  - cli
  - init
  - no-git
dependencies: []
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Flag appears in help
- [ ] #2 Init completes without git
- [ ] #3 Config disables branches/remote/autocommit
- [ ] #4 New test validates no-git init and task creation
- [ ] #5 Docs updated (README, DEVELOPMENT)
<!-- AC:END -->

## Implementation Plan

Wire flag; override config; add tests; update docs
