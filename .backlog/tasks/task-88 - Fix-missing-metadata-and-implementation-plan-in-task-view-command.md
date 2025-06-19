---
id: task-88
title: Fix missing metadata and implementation plan in task view command
status: In Progress
assignee:
  - '@claude'
created_date: '2025-06-19'
updated_date: '2025-06-19'
labels:
  - bug
  - cli
dependencies: []
---

## Description

The task view command (backlog task <id>) is not displaying all task information. It currently only shows Description and Acceptance Criteria sections, but is missing metadata (status, assignee, labels, dates) and the Implementation Plan section if present.

## Acceptance Criteria

- [ ] Task view displays all metadata (status, assignee, labels, created/updated dates)
- [ ] Implementation Plan section is shown if present
- [ ] Implementation Notes section is shown if present
- [ ] All sections maintain proper formatting
- [ ] Plain mode (--plain) also includes all information
- [ ] Interactive (non-plain) mode shows the same complete information as plain mode
