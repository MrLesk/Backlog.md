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
Updated default task statuses to remove `Draft` and set `To Do` as default. Added `--draft` option to the CLI create command and updated tests and documentation accordingly.
