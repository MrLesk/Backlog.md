---
id: task-266
title: Add --no-git init mode
status: Done
assignee:
  - '@pjsample'
created_date: '2025-09-14 13:59'
updated_date: '2025-09-14 16:37'
labels:
  - cli
  - init
  - no-git
dependencies: []
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Flag appears in help
- [x] #2 Init completes without git
- [x] #3 Config disables branches/remote/autocommit
- [x] #4 New test validates no-git init and task creation
- [x] #5 Docs updated (README, DEVELOPMENT)
<!-- AC:END -->


## Implementation Plan

Wire flag; override config; add tests; update docs

## Implementation Notes

Implemented --no-git init mode; added test; updated docs; ready for PR.
