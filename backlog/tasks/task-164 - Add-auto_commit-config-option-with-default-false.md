---
id: task-164
title: Add auto_commit config option with default false
status: In Progress
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

## Implementation Notes

Successfully implemented autoCommit configuration option with default false value.

**Implementation Details:**
- Added autoCommit field to BacklogConfig type definition
- Updated config migration to include autoCommit with default false for existing projects
- Modified Core class methods to check autoCommit config before performing git operations
- Updated CLI commands to remove hardcoded autoCommit=true parameters
- Added config command support for getting/setting autoCommit option
- All git operations now respect the autoCommit setting from config

**Files Modified:**
- src/types/index.ts - Added autoCommit?: boolean to BacklogConfig
- src/core/config-migration.ts - Added autoCommit: false to defaults and migration
- src/core/backlog.ts - Added shouldAutoCommit() helper and updated all methods
- src/cli.ts - Removed hardcoded autoCommit=true from CLI commands, added config support
- src/file-system/operations.ts - Added autoCommit serialization and parsing

**Usage:**
- bun run cli config set autoCommit true/false
- bun run cli config get autoCommit
- bun run cli config list (shows autoCommit value)

**Backward Compatibility:**
- Existing projects will have autoCommit=false after migration
- Project initialization still defaults to autoCommit=true for the init commit
- All Core methods accept optional autoCommit parameter to override config
