---
id: task-231
title: Fix case-insensitive status grouping and status normalization
status: Done
assignee:
  - '@codex'
created_date: '2025-08-12 19:39'
updated_date: '2025-08-12 19:40'
labels: []
dependencies: []
---

## Description

Fix board export and TUI grouping to treat statuses case-insensitively (merge "To Do"/"To do"), ensure tasks like task-228 appear under the correct column, and validate/normalize status on create/edit. Includes tests.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Board export groups statuses case-insensitively (no duplicate columns)
- [x] #2 TUI board groups statuses case-insensitively and shows tasks under canonical status
- [x] #3 Status is validated and normalized on task create/edit; invalid statuses error
- [x] #4 All tests pass and README board export renders correct columns
<!-- AC:END -->

## Implementation Notes

Implemented case-insensitive grouping for board export and TUI; added status normalization + validation in CLI create/edit; added tests; verified full suite passes.
