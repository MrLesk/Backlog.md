---
id: task-201
title: Add configurable git hooks bypass option
status: Done
assignee:
  - '@agavr'
created_date: '2025-07-23'
updated_date: '2025-07-26'
labels:
  - enhancement
  - git
dependencies: []
---

## Description

Allow users to optionally bypass git hooks when committing backlog changes. This addresses scenarios where pre-commit hooks (like conventional commits or linters) interfere with backlog.md's automated commits. The option should be configurable through config.yml and prompted during init wizard when remote operations are enabled.

Based on contribution from PR #214: https://github.com/MrLesk/Backlog.md/pull/214

## Implementation Plan

1. **Add bypassGitHooks to configuration schema**
   - Update `src/types/index.ts` to add `bypassGitHooks?: boolean` to BacklogConfig type
   - Update `src/config.ts` to add validation for the new option
   - Set default value to `false` in config defaults

2. **Update init wizard**
   - Modify `src/init/wizard.ts` to prompt for git hooks bypass when `remoteOperations` is enabled
   - Add the prompt after remote operations is confirmed
   - Save the preference to config.yml

3. **Modify git operations**
   - Update `src/git.ts` to check for `bypassGitHooks` config
   - Add `--no-verify` flag to all git commit commands when enabled
   - Ensure this applies to all commit operations (task updates, board commits, etc.)

4. **Add config set support**
   - Update `src/commands/config.ts` to handle the new `bypassGitHooks` option
   - Add validation to ensure boolean values only

5. **Update documentation**
   - Add bypassGitHooks option to README configuration section
   - Explain when and why to use this option

6. **Testing**
   - Write tests for config validation
   - Test init wizard flow with and without remote operations
   - Test git commit operations with bypass enabled/disabled

## Implementation Notes

Successfully implemented the bypassGitHooks configuration option:

1. **Configuration Schema**: Added `bypassGitHooks?: boolean` to the BacklogConfig interface in `src/types/index.ts`
2. **Default Config**: Added default value of `false` in `src/core/config-migration.ts`
3. **Config Parser**: Updated `src/file-system/operations.ts` to parse `bypass_git_hooks` from config.yml and serialize it back
4. **Init Wizard**: Added conditional prompt in `src/cli.ts` that only shows when `remoteOperations` is enabled
5. **Git Operations**: Modified `commitTaskChange`, `commitChanges`, and `commitStagedChanges` methods in `src/git/operations.ts` to add `--no-verify` flag when `bypassGitHooks` is true
6. **Config Commands**: Added support for getting and setting `bypassGitHooks` via the config command
7. **Documentation**: Updated README.md with the new configuration option in both the configuration table and CLI reference

The implementation follows the existing patterns in the codebase and maintains backward compatibility. The feature is opt-in with a default value of `false`.

## Acceptance Criteria

- [x] Add bypassGitHooks config option (default: false)
- [x] Init wizard prompts for git hooks bypass when remoteOperations is true
- [x] When enabled, all git commit operations use --no-verify flag
- [x] Config option is documented in README
- [x] Only prompted when user enables remote operations during init
- [x] Existing projects can update this setting via config set command
