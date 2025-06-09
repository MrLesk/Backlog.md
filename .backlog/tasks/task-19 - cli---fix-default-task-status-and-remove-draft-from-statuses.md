---
id: task-19
title: CLI - fix default task status and remove Draft from statuses
status: To Do
assignee:
  - '@MrLesk'
created_date: '2025-06-09'
labels: []
dependencies: []
---
## Description
The CLI currently creates tasks in the "Draft" status by default and includes "Draft" in the list of task statuses. Draft tasks should be handled separately.

## Acceptance Criteria
- [ ] `backlog task create` without options creates a task in `.backlog/tasks` with status `To Do`.
- [ ] `backlog task create --draft` creates a draft task in `.backlog/drafts` with status `Draft`.
- [ ] `config.yml` no longer lists `Draft` in the `statuses` array and sets `default_status` to `To Do`.
- [ ] Documentation updated to reflect the new behaviour.
