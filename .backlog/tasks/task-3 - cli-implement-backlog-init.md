---
id: task-3
title: "CLI: Implement `backlog init` Command"
status: "In Progress"
assignee: "@MrLesk"
reporter: "@MrLesk"
created_date: 2025-06-04
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-2"]
---

## Description

Implement the `backlog init <project-name>` command in the CLI. This command will set up the `.backlog` directory structure and a `config.yml` in the current Git repository.

## Acceptance Criteria

- [ ] `backlog init <project-name>` command creates all necessary subdirectories within `.backlog`.
- [ ] `backlog init <project-name>` creates an initial commit for the `.backlog` structure.
- [ ] Command provides appropriate user feedback.
