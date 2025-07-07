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

- [ ] Add a `remoteOperations` config option (default: true) to enable/disable remote git operations
- [ ] Display informative warnings when remote fetch fails due to network connectivity (not just in debug mode)
- [ ] Implement graceful fallback messaging when remote tasks cannot be loaded
- [ ] Ensure `backlog board`, `backlog board view`, and `backlog board export` commands work seamlessly when remote operations are disabled
- [ ] Task ID generation continues to work when remote operations are disabled (using only local branches)
- [ ] Config can be set via `backlog config set remoteOperations false`

## Technical Notes

**Current Behavior:**
- `loadRemoteTasks()` in `src/core/remote-tasks.ts` calls `gitOps.fetch()` but only shows errors in debug mode
- `generateNextId()` in `src/cli.ts` performs git fetch for ID uniqueness but suppresses network errors
- Board commands load remote tasks in parallel but fail silently when offline

**Proposed Implementation:**
- Add `remoteOperations` to config schema with validation
- Add `remoteOperations` config value to migration logic for existing projects
- Modify `GitOperations.fetch()` to check config before attempting remote operations
- Enhance error handling to distinguish network vs. other git errors and provide user-friendly messaging
- Update `loadRemoteTasks()` and `generateNextId()` to respect the config setting
