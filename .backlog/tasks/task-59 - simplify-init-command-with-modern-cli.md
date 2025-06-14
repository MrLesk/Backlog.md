---
id: task-59
title: Simplify init command with modern CLI
status: In Progress
assignee:
  - '@codex'
created_date: '2025-06-14'
labels:
  - cli
dependencies: []
---

## Description
Simplify the `backlog init` command by removing the TUI wizard and replacing it with a plain CLI questionnaire similar to modern tools like `vue-cli`. The agent instruction file selection should use checkboxes rendered directly in the terminal. Users can navigate with arrow keys, toggle selections with <space>, and press <enter> to confirm. Display a hint explaining these controls.

## Acceptance Criteria
- [ ] `backlog init` prompts for project and reporter names using standard text prompts
- [ ] Agent selection presents checkboxes and instructions on how to select
- [ ] Implementation relies on a lightweight prompt library (e.g. `prompts`)
- [ ] No `blessed` TUI is used during init
- [ ] Tests and lint pass
