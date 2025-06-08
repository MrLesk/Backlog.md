---
id: task-4.5
title: 'CLI: Auto-Set Reporter'
status: Draft
created_date: '2025-06-08'
labels: []
dependencies: []
parent_task_id: '4'
---

## Description

Automatically set the reporter field when creating tasks by establishing user identity during project initialization and using it for all subsequent task creation.

## Implementation Flow

### During `backlog init`:
1. Check project-level git config for `user.name` and `user.email`
2. If found, prompt: "Use git user 'John Doe <john@example.com>' as default reporter? [Y/n]"
3. If not found or declined, check global git config
4. If global config found, prompt: "Use global git user 'John Doe <john@example.com>' as default reporter? [Y/n]"
5. If no git config or declined, prompt: "Enter default reporter name:"
6. Save selected reporter to project config (`config.yml`)

### During task creation:
- Use configured default reporter from project config
- Allow override with `--reporter <value>` flag

## Acceptance Criteria

**✅ Initialization Flow:**
- [ ] `backlog init` checks project git config (`git config user.name` and `git config user.email`)
- [ ] If project config exists, prompt user to confirm using it as default reporter
- [ ] If no project config, fallback to global git config (`git config --global user.name/email`)
- [ ] If no git config available, prompt user to manually enter reporter name
- [ ] Save selected reporter in `.backlog/config.yml` as `defaultReporter`

**✅ Task Creation Integration:**
- [ ] `backlog task create` automatically uses `defaultReporter` from config
- [ ] `backlog draft create` automatically uses `defaultReporter` from config
- [ ] Allow manual override with `--reporter <value>` flag during task creation
- [ ] Display current default reporter in `backlog config` commands

**✅ Error Handling:**
- [ ] Handle cases where git commands fail or are unavailable
- [ ] Gracefully handle empty/invalid git configurations
- [ ] Provide clear prompts and error messages throughout the flow

**✅ Testing:**
- [ ] Unit tests for different git configuration scenarios
- [ ] Integration tests for full init → task creation workflow
- [ ] Tests for manual reporter override functionality
