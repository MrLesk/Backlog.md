---
id: task-354.02
title: 'CLI + MCP: DoD create options and outputs'
status: To Do
assignee:
  - '@codex'
created_date: '2025-12-28 20:34'
updated_date: '2025-12-28 20:51'
labels: []
dependencies:
  - task-354.01
  - task-354.05
parent_task_id: task-354
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose Definition of Done defaults and overrides in CLI and MCP task creation, and show the checklist in task detail outputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI `backlog task create` exposes DoD inputs to replace defaults, append to defaults, or disable defaults (documented in `--help`).
- [ ] #2 MCP `task_create` accepts DoD override/append/disable inputs and applies config defaults when omitted.
- [ ] #3 CLI task edit supports checking/unchecking DoD items (separate from acceptance criteria).
- [ ] #4 MCP `task_edit` supports DoD check/uncheck operations and `task_view` returns DoD items with checked state.
- [ ] #5 CLI `--plain` task output includes a `Definition of Done` section with checked/unchecked items.

- [ ] #6 CLI/MCP tests cover create, edit, and view behavior for DoD (defaults, override/append, check/uncheck).
<!-- AC:END -->
