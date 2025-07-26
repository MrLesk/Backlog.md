---
id: task-201
title: Add configurable git hooks bypass option
status: In Progress
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

## Acceptance Criteria

- [ ] Add bypassGitHooks config option (default: false)
- [ ] Init wizard prompts for git hooks bypass when remoteOperations is true
- [ ] When enabled, all git commit operations use --no-verify flag
- [ ] Config option is documented in README
- [ ] Only prompted when user enables remote operations during init
- [ ] Existing projects can update this setting via config set command
