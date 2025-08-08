---
id: task-225
title: Fix CLI board command ignoring checkActiveBranches config setting
status: In Progress
assignee: []
created_date: '2025-08-08 19:01'
updated_date: '2025-08-08 19:05'
labels:
  - bug
  - performance
dependencies: []
---

## Description

The CLI board command always performs cross-branch checking regardless of the checkActiveBranches configuration setting, causing severe performance issues on large repositories. Users report 30-60 second load times even with checkActiveBranches set to false. The issue is in src/cli.ts where the board command unconditionally calls getLatestTaskStatesForIds(), while the Core module in src/core/backlog.ts correctly respects the setting. Additionally, the activeBranchDays default in cross-branch-tasks.ts is set to 9999 instead of using the configured value. This needs to be fixed to respect the user's configuration and improve performance for large repositories.

## Acceptance Criteria

- [ ] CLI board command respects checkActiveBranches=false configuration and skips cross-branch checking
- [ ] Board load time is under 5 seconds for large repositories when checkActiveBranches is disabled
- [ ] activeBranchDays uses configured value instead of hardcoded 9999 default
- [ ] Performance improvement is measurable and documented
