---
id: task-214
title: Add CLI command to list sequences (plain text output)
status: To Do
assignee: []
created_date: '2025-07-27'
updated_date: '2025-07-27'
labels:
  - sequences
  - cli
dependencies:
  - task-213
---

## Description

Provide a way to inspect computed sequences via plain text output for command line usage. AI agents and scripts need a machine-readable plain-text format. This command should build on the core compute function from Task 213 and not duplicate logic.

## Acceptance Criteria

- [ ] Introduce a backlog sequence list command that outputs sequences in plain text format by default.
- [ ] Output sequences in a machine-readable plain format: list each sequence with its index and tasks formatted as "TASK-{task id} - task title".
- [ ] Reuse the core sequence function from Task 213; do not compute sequences separately in the CLI.
- [ ] Provide help text in the CLI explaining usage and output format.
- [ ] Add tests verifying that the plain output matches expected formats.

