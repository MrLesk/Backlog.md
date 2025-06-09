---
id: task-5
title: "CLI: Implement Docs & Decisions CLI Commands (Basic)"
status: "To Do"
assignee: []
reporter: @MrLesk
created_date: 2025-06-04
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-3"]
---

## Description

Implement basic CLI commands for managing documentation and decision logs:

- `backlog doc create <path> <title>` (to create a new documentation file)
- `backlog doc create <title>` (to create a new documentation file in the root folder)
- `backlog doc list`
- `backlog decision create <title>`
- `backlog decision list`

## Acceptance Criteria

- [ ] Creation and listing commands functional for docs and decisions.
- [ ] Files are created in the correct `.backlog/docs/` and `.backlog/decisions/` directories.
