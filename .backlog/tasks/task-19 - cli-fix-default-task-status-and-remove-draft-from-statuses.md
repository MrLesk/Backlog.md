---
id: task-19
title: CLI - fix default task status and remove Draft from statuses
status: Done
reporter: @MrLesk
created_date: '2025-06-09'
labels: []
dependencies: []
---
## Description
The CLI currently creates tasks in the "Draft" status by default and includes "Draft" in the list of task statuses. Draft tasks should be handled separately.

## Acceptance Criteria
- [x] `backlog task create` without options creates a task in `.backlog/tasks` with status `To Do`.
- [x] `backlog task create --draft` creates a draft task in `.backlog/drafts` with status `Draft`.
- [x] `config.yml` no longer lists `Draft` in the `statuses` array and sets `default_status` to `To Do`.
- [x] Documentation updated to reflect the new behaviour.

## Implementation Notes

**Constants Updated (src/constants/index.ts:36-41):**
- Changed `DEFAULT_STATUSES` from `["Draft", "To Do", "In Progress", "Done"]` to `["To Do", "In Progress", "Done"]`
- Set `FALLBACK_STATUS` to `"To Do"` instead of `"Draft"`
- Removed "Draft" from the standard workflow statuses

**CLI Command Enhancement (src/cli.ts:191-204):**
- Added `--draft` option to `backlog task create` command
- When `--draft` flag is used, task is created in `.backlog/drafts` using `core.createDraft()`
- Without `--draft` flag, task is created in `.backlog/tasks` using `core.createTask()`
- Both operations properly handle the status assignment based on context

**Configuration Updates:**
- Project `config.yml` now shows `statuses: ["To Do", "In Progress", "Done"]` (no Draft)
- Default status set to `"To Do"` in configuration files
- Draft tasks are managed separately from the main workflow statuses

**Documentation Updates (readme.md):**
- Line 74: Added `--draft` option documentation for task creation
- Line 199: Added explanation that "Draft tasks are stored separately under `.backlog/drafts`"
- Clear distinction between workflow statuses and draft storage location

**Test Verification:**
- All 35 CLI integration tests pass
- All 20 core tests pass
- Manual testing confirms regular tasks created with "To Do" status in `.backlog/tasks`
- Manual testing confirms draft tasks created with "Draft" status in `.backlog/drafts`

**Workflow Impact:**
- Regular task creation: `backlog task create "Title"` → `.backlog/tasks` with status "To Do"
- Draft task creation: `backlog task create "Title" --draft` → `.backlog/drafts` with status "Draft"
- Kanban board and listing commands now show only workflow statuses: To Do, In Progress, Done
- Draft tasks are managed through separate `backlog draft` commands

The implementation successfully separates draft handling from the main task workflow while maintaining backward compatibility and clear user experience.
