---
id: task-4.13
title: 'CLI: Fix config command local/global logic'
status: Draft
assignee: []
created_date: '2025-06-09'
labels: []
dependencies: []
parent_task_id: task-4
---
## Description

Fix config commands to correctly use local or global config files

## Acceptance Criteria
- [ ] `backlog config set <key> <value> --local` saves changes to `.backlog/config.yml`.
- [ ] `backlog config set <key> <value> --global` saves changes to the user config file.
- [ ] `backlog config get <key>` checks local config first, then global config, then defaults.
- [ ] Behavior prioritizes local configuration over global and built-in defaults.
- [ ] Documentation updated to describe local and global configuration behavior.
