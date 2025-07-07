---
id: task-164
title: Add auto_commit config option with default false
status: To Do
assignee: []
created_date: '2025-07-07'
updated_date: '2025-07-07'
labels:
  - enhancement
  - config
dependencies: []
---

## Description

Add configuration option to disable automatic git commits based on user feedback in issues #160 and #164. Users want control over their git history and commit conventions.

## Acceptance Criteria

- [ ] Add autoCommit field to BacklogConfig type definition
- [ ] Update config schema migration to include autoCommit with default false
- [ ] Modify Core class to respect autoCommit setting for all git operations
- [ ] Update CLI commands to check autoCommit config before committing
- [ ] Add config command support for setting autoCommit option
- [ ] Update tests to verify autoCommit behavior works correctly
- [ ] Add documentation for autoCommit configuration option
