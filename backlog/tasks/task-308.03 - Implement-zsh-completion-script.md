---
id: task-308.03
title: Implement zsh completion script
status: Done
assignee: []
created_date: '2025-10-23 10:08'
updated_date: '2025-10-23 11:25'
labels:
  - zsh
  - completion
dependencies:
  - task-308.01
parent_task_id: task-308
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create zsh completion script for the backlog CLI that provides tab completion for commands, subcommands, and options.

The script should follow zsh completion conventions (_backlog function) and support:
- Completion of top-level commands
- Completion of subcommands
- Completion of flags and options with descriptions
- Dynamic completions where applicable
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Zsh completion script created (_backlog function)
- [ ] #2 Top-level commands complete correctly
- [ ] #3 Subcommands complete for 'backlog task', 'backlog doc', etc.
- [ ] #4 Flags and options complete with descriptions
- [ ] #5 Script follows zsh completion conventions
- [ ] #6 Tested in zsh 5.x
<!-- AC:END -->
