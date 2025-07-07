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

- [x] Add a `remoteOperations` config option (default: true) to enable/disable remote git operations
- [x] Display informative warnings when remote fetch fails due to network connectivity (not just in debug mode)
- [x] Implement graceful fallback messaging when remote tasks cannot be loaded
- [x] Ensure `backlog board`, `backlog board view`, and `backlog board export` commands work seamlessly when remote operations are disabled
- [x] Task ID generation continues to work when remote operations are disabled (using only local branches)
- [x] Config can be set via `backlog config set remoteOperations false`

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

## Implementation Plan

1. **Add config schema field** - Update `BacklogConfig` interface to include `remoteOperations?: boolean`
2. **Update migration logic** - Add default value `true` in `config-migration.ts` and check for field in `needsMigration()`
3. **Enhance GitOperations** - Modify `fetch()` to check config and add network error detection
4. **Update core functions** - Modify `loadRemoteTasks()` and `generateNextId()` to respect config
5. **Update CLI commands** - Add support in `config get/set/list` commands
6. **Add comprehensive tests** - Unit tests for offline behavior and integration tests for full workflow
7. **Update documentation** - Ensure config commands show the new option

## Implementation Notes

- **Configuration approach chosen over CLI flags** - Using a config value (`remoteOperations`) provides a better user experience than requiring `--offline` flags on every command
- **Default value is `true`** - To maintain backward compatibility, remote operations are enabled by default
- **Network error detection** - Added intelligent error pattern matching to distinguish network errors from other git errors (e.g., "could not resolve host", "connection refused", "network is unreachable")
- **Graceful degradation** - When offline or when remote operations are disabled, the system continues to work with local data only
- **Migration handling** - The migration logic filters out `undefined` values to ensure defaults are properly applied
- **Test coverage** - Created two comprehensive test suites: `offline-mode.test.ts` for unit tests and `offline-integration.test.ts` for full workflow testing
- **Config is loaded lazily** - Since the Core constructor can't be async, config is loaded when needed via `ensureConfigLoaded()`
- **Parameter naming** - Changed `config` parameter in `loadRemoteTasks` to `userConfig` to avoid variable shadowing
