---
id: BACK-308.03
title: Implement zsh completion script
status: Done
assignee: []
created_date: '2025-10-23 10:08'
updated_date: '2025-10-27 21:33'
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
- [x] #1 Zsh completion script created (_backlog function)
- [x] #2 Top-level commands complete correctly
- [x] #3 Subcommands complete for 'backlog task', 'backlog doc', etc.
- [x] #4 Flags and options complete with descriptions
- [x] #5 Script follows zsh completion conventions
- [x] #6 Tested in zsh 5.x
<!-- AC:END -->
