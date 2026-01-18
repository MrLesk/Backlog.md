---
id: BACK-354.02
title: 'CLI + MCP: DoD create options and outputs'
status: Done
assignee:
  - '@codex'
created_date: '2025-12-28 20:34'
updated_date: '2026-01-17 21:58'
labels: []
dependencies:
  - task-354.01
  - task-354.05
parent_task_id: BACK-354
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose Definition of Done defaults and overrides in CLI and MCP task creation, and show the checklist in task detail outputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI `backlog task create` exposes DoD inputs to replace defaults, append to defaults, or disable defaults (documented in `--help`).
- [x] #2 MCP `task_create` accepts DoD override/append/disable inputs and applies config defaults when omitted.
- [x] #3 CLI task edit supports checking/unchecking DoD items (separate from acceptance criteria).
- [x] #4 MCP `task_edit` supports DoD check/uncheck operations and `task_view` returns DoD items with checked state.
- [x] #5 CLI `--plain` task output includes a `Definition of Done` section with checked/unchecked items.

- [x] #6 CLI/MCP tests cover create, edit, and view behavior for DoD (defaults, override/append, check/uncheck).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Confirm CLI flags/help for DoD create/edit and `--no-dod-defaults` are wired to task inputs.
2) Ensure MCP schema + handlers accept DoD add/remove/check/uncheck and defaults-disable fields; task_view returns DoD items.
3) Add/adjust CLI plain output to show Definition of Done checklist.
4) Add CLI/MCP tests for create defaults/disable/add and edit check/uncheck/remove; update snapshots as needed.
5) Run targeted tests for CLI/MCP flows.
<!-- SECTION:PLAN:END -->
