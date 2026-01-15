---
id: BACK-13.1
title: 'CLI: Agent Instruction File Selection'
status: Done
assignee: []
reporter: '@MrLesk'
created_date: '2025-06-09'
updated_date: '2025-06-09'
labels:
  - cli
  - agents
dependencies: []
parent_task_id: task-13
---

## Description

Replace the existing yes/no prompt in `backlog init` with a multi-select menu. Users can choose any combination of the following guideline files to update with Backlog instructions:

- `.cursorrules`
- `CLAUDE.md`
- `AGENTS.md`
- `README.md`

## Acceptance Criteria

- [x] `backlog init` displays a multi-select prompt for agent instruction files.
- [x] Users can select one or more files, or skip entirely.
- [x] Selected files are created or appended with instructions; unselected files remain unchanged.
- [x] Automated tests cover the new selection flow.

## Implementation Notes

* Replaced yes/no prompt with numbered multi-select menu in `src/cli.ts:52-65`.
* Users can select from `.cursorrules`, `CLAUDE.md`, `AGENTS.md`, and `README.md` files.
* Menu displays numbered options (1-4) and accepts comma-separated selections.
* Blank input skips agent instruction file creation entirely.
* Implementation uses `addAgentInstructions()` function to handle file creation/appending.
* Test coverage provided by "should create agent instruction files when requested" in `src/test/cli.test.ts`.
* Maintains backward compatibility while improving user experience with more granular control.
