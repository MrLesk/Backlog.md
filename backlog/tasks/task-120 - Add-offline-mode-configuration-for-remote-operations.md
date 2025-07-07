---
id: task-120
title: Add offline mode configuration for remote operations
status: To Do
assignee: []
created_date: '2025-07-07'
labels:
  - enhancement
  - offline
  - config
dependencies: []
priority: high
---

## Description

Backlog.md currently performs git fetch operations silently in the background when loading remote tasks and generating task IDs. When network connectivity is unavailable, these operations fail silently with errors only visible in debug mode. Users working offline need better visibility into connectivity issues and explicit control over when remote operations are attempted.

## Acceptance Criteria

- [ ] Config can be set via backlog config set remoteOperations false
