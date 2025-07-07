---
id: task-165
title: Fix BUN_OPTIONS environment variable conflict
status: Done
assignee: []
created_date: '2025-07-07'
updated_date: '2025-07-07'
labels:
  - bug
dependencies: []
---

## Description

Issue #168: Setting BUN_OPTIONS environment variable prevents backlog from running. When BUN_OPTIONS is set to '--bun', it causes 'unknown option' error when running backlog commands.

## Acceptance Criteria

- [x] Identify where BUN_OPTIONS is affecting CLI execution
- [x] Implement solution to isolate backlog CLI from BUN_OPTIONS
- [x] Test with various BUN_OPTIONS configurations
- [x] Ensure backward compatibility with existing setups

## Implementation Notes

Successfully implemented intelligent fix for BUN_OPTIONS environment variable conflict.

**Root Cause:**
BUN_OPTIONS environment variable was interfering with CLI execution in the compiled executable, causing 'unknown option' errors like "error: unknown option '--bun'". This occurs because the compiled executable still processes BUN_OPTIONS but Commander.js doesn't understand Bun-specific options.

**Solution Implemented:**
Intelligent solution that temporarily isolates BUN_OPTIONS during CLI parsing while preserving it for subsequent commands:

1. **Temporary Isolation**: Save and clear BUN_OPTIONS before Commander.js processes arguments
2. **Environment Preservation**: Restore BUN_OPTIONS after CLI parsing completes
3. **User-Friendly**: Maintains BUN_OPTIONS for subsequent commands in user workflows
4. **Prevents Conflicts**: Eliminates "unknown option" errors from Bun-specific flags
5. **Zero Maintenance**: No hardcoded option lists to maintain

**Files Modified:**
- src/cli.ts - Added BUN_OPTIONS save/clear/restore logic around Commander.js parsing
- src/test/bun-options.test.ts - Comprehensive tests for isolation and restoration

**Testing:**
- All unit tests pass
- Verified BUN_OPTIONS isolation prevents CLI parsing conflicts
- Verified BUN_OPTIONS restoration for subsequent command usage
- Tested with workflows like `BUN_OPTIONS="--silent" backlog task list && bun run script.js`
- Handles missing BUN_OPTIONS gracefully

**User Workflow Benefits:**
- Supports command chains: `BUN_OPTIONS="--config=custom.toml" backlog task list && bun run deploy.js`
- Preserves user environment expectations
- No interference with legitimate BUN_OPTIONS usage

**Backward Compatibility:**
- No impact on existing functionality
- Resolves the specific issue reported in GitHub #168
- Works optimally with the compiled executable architecture
