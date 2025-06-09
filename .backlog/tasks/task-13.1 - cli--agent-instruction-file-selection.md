---
id: task-13.1
title: "CLI: Agent Instruction File Selection"
status: "To Do"
assignee: []
reporter: @MrLesk
created_date: '2025-06-09'
labels:
  - cli
  - agents
dependencies: []
parent_task_id: task-13
---

## Description

Replace the existing yes/no prompt in `backlog init` with a multi-select menu. Users can choose any combination of the following guideline files to update with Backlog instructions:

- `.cursoreules`
- `CLAUDE.md`
- `AGENTS.md`
- `readme.md`

## Acceptance Criteria

- [ ] `backlog init` displays a multi-select prompt for agent instruction files.
- [ ] Users can select one or more files, or skip entirely.
- [ ] Selected files are created or appended with instructions; unselected files remain unchanged.
- [ ] Automated tests cover the new selection flow.
