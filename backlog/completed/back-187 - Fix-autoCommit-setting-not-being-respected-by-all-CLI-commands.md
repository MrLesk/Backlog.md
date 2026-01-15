---
id: BACK-187
title: Fix autoCommit setting not being respected by all CLI commands
status: Done
assignee:
  - '@mjgs'
created_date: '2025-07-12'
updated_date: '2025-07-13'
labels:
  - bug
  - config
  - git
  - cli
dependencies: []
priority: high
---

## Description

The `autoCommit` configuration setting in `config.yml` was not being consistently respected across all CLI commands. Some commands were hardcoded to always commit (passing `true` to autoCommit parameters), while others were ignoring the setting entirely. This led to inconsistent behavior where users couldn't reliably control git commit behavior through configuration.

## Acceptance Criteria

- [x] Remove hardcoded `true` values from `core.createDocument()` calls in CLI
- [x] Remove hardcoded `true` values from `core.createDecision()` calls in CLI  
- [x] Remove hardcoded `true` values from `core.archiveDraft()` calls in CLI
- [x] Ensure all Core methods check config.autoCommit before performing git commits
- [x] Add comprehensive E2E tests for autoCommit behavior with both true and false settings
- [x] Test task creation, document creation, and decision creation with both autoCommit modes
- [x] Verify git repository state after operations (clean vs dirty) based on autoCommit setting
- [x] Ensure commit count increases only when autoCommit is enabled

## Implementation Plan

1. **Audit CLI commands for hardcoded autoCommit values**
   - Find all instances where `true` is passed to autoCommit parameters
   - Replace with default parameter handling (undefined) to let Core decide

2. **Update CLI command implementations**
   - `doc create`: Change from `core.createDocument(document, true, ...)` to `core.createDocument(document, undefined, ...)`
   - `decision create`: Change from `core.createDecision(decision, true)` to `core.createDecision(decision)`
   - `draft archive`: Change from `core.archiveDraft(taskId, true)` to `core.archiveDraft(taskId)`

3. **Ensure Core methods respect configuration**
   - Verify that Core methods check `config.autoCommit` before performing git operations
   - Ensure default behavior when autoCommit is undefined

4. **Add comprehensive testing**
   - Create E2E tests using `Bun.spawnSync` to test actual CLI behavior
   - Test both `autoCommit: true` and `autoCommit: false` scenarios
   - Verify git repository state after each operation
   - Use git commit count to verify commit behavior

## Implementation Notes

Removed hardcoded `true` values from CLI commands that were bypassing the `autoCommit` configuration setting. The fix involved changing three commands:
- `doc create`: Changed `core.createDocument(document, true, ...)` to `core.createDocument(document, undefined, ...)`
- `decision create`: Changed `core.createDecision(decision, true)` to `core.createDecision(decision)`
- `draft archive`: Changed `core.archiveDraft(taskId, true)` to `core.archiveDraft(taskId)`

Added comprehensive E2E tests in `src/test/cli-commit-behaviour.test.ts` that verify the behavior works correctly with both `autoCommit: true` and `autoCommit: false` configurations. Tests check git repository state (clean vs dirty) and commit count to ensure commits only happen when expected.

The root cause was hardcoded parameters in the CLI layer overriding the user's configuration preference. Core methods were already designed to respect the config, but the CLI wasn't letting them.