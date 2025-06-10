---
id: task-33
title: 'CLI: fix empty agent instruction files on init'
status: To Do
assignee: []
reporter: @MrLesk
created_date: '2025-06-10'
labels:
  - cli
  - bug
dependencies: []
---

## Description

Backlog init should populate selected agent instruction files with default content instead of creating empty files.

## Acceptance Criteria

- [ ] Selected agent instruction files contain default guideline text after running `backlog init`
- [ ] Automated test verifies non-empty content is written to each created file

