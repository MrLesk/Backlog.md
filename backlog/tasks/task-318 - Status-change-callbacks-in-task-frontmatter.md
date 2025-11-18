---
id: task-318
title: Status change callbacks in task frontmatter
status: To Do
assignee:
  - '@codex'
created_date: '2025-11-18 19:31'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow tasks to define shell command callbacks in frontmatter that run automatically when task status changes. Commands should execute when status updates are triggered through Backlog.md workflows and should be configurable as bash commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task frontmatter supports declaring bash commands to run on status changes
- [ ] #2 Status updates automatically execute configured callbacks and record their results
- [ ] #3 Callback failures are reported without blocking status change persistence
- [ ] #4 Documentation explains how to configure and use status change callbacks
<!-- AC:END -->
