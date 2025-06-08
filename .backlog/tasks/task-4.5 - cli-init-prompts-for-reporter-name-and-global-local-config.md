---
id: task-4.5
title: "CLI: Init prompts for reporter name and global/local config"
status: "To Do"
assignee: ""
reporter: "@MrLesk"
created_date: 2025-06-08
labels: ["cli", "config"]
milestone: "M1 - CLI"
dependencies: ["task-3"]
parent_task_id: task-4
---

## Description

Enhance `backlog init` with interactive prompts:

- Ask for a default **reporter** name for new tasks.
- Prompt whether to store this configuration globally or only for the current repository.
- When storing locally, create a hidden `.user` settings file and make sure it is ignored by Git.

## Acceptance Criteria

- [ ] Running `backlog init` asks for a default reporter name.
- [ ] User can choose between storing the reporter setting globally or locally.
- [ ] Choosing the local option creates a `.user` settings file and appends it to `.gitignore`.
- [ ] Reporter name saved based on the chosen scope.
