---
id: BACK-399
title: Add configurable tasksDirectory for custom task storage path
status: Done
assignee: []
created_date: '2026-02-23 22:34'
updated_date: '2026-02-24 09:41'
labels:
  - feature
  - configuration
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem
Currently Backlog.md uses a single local directory (`backlog/`) for both configuration and tasks. Users need the ability to store tasks in a different location while keeping configuration local.

## Solution
Add a configurable `tasksDirectory` parameter that allows storing tasks in a custom path (default: `backlog/tasks`).

### Requirements
1. **Keep local config**: Configuration stays in `{project}/backlog/config.yml`
2. **Configurable tasks path**: Add `tasksDirectory` config parameter (default: `backlog/tasks`)
3. **CLI support**: Add support in `backlog config get/set/list` commands
4. **Wizard support**: Add question in `backlog config init` wizard (Advanced Settings)
5. **MCP support**: Both CLI and MCP must use the configured directory

### Scope
- Tasks, completed tasks, and drafts move to custom path
- Documents and milestones stay in local `backlog/` directory
- Auto-create directory if it doesn't exist

### Implementation Details
1. Add `tasksDirectory?: string` to `BacklogConfig` in `src/types/index.ts`
2. Update `src/file-system/operations.ts` getters to use config
3. Update `src/cli.ts` config get/set/list commands
4. Update `src/commands/advanced-config-wizard.ts` with new question

### Related Files
- `src/types/index.ts` - Config interface
- `src/file-system/operations.ts` - Path getters
- `src/cli.ts` - CLI commands
- `src/commands/advanced-config-wizard.ts` - Wizard
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes
- [ ] #6 bun test src/test/config-commands.test.ts passes
- [ ] #7 Manual CLI test: config get/set/list works
- [ ] #8 Manual CLI test: task operations work with custom path
- [ ] #9 Manual MCP test: MCP tools use custom path
<!-- DOD:END -->



## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog config get tasksDirectory returns current value (or empty if not set)
- [ ] #2 backlog config set tasksDirectory /custom/path sets the path
- [ ] #3 backlog config list shows tasksDirectory with default value
- [ ] #4 backlog config init wizard asks for tasks directory in Advanced Settings
- [ ] #5 backlog task list reads tasks from custom path when configured
- [ ] #6 MCP tools (task list, task create, etc.) use custom tasks directory
- [ ] #7 Custom directory is auto-created if it doesn't exist
- [ ] #8 Relative paths are resolved relative to project root
<!-- AC:END -->
