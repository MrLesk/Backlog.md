---
id: BACK-355.02
title: 'CLI: Add --type flag to task create and edit commands'
status: To Do
assignee: []
created_date: '2026-01-01 23:37'
labels:
  - cli
dependencies:
  - task-355.01
parent_task_id: task-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend CLI commands to support the type field, allowing users to specify and modify task types from the command line.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task create command accepts --type flag with autocomplete for configured types
- [ ] #2 task edit command accepts --type flag to modify existing task type
- [ ] #3 task list output displays type field (abbreviated in table view)
- [ ] #4 task view (plain mode) includes type in output
- [ ] #5 Invalid type values produce clear error message listing valid options
- [ ] #6 CLI help text documents the --type flag
<!-- AC:END -->
