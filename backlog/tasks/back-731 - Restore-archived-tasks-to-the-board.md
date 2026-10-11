---
id: BACK-731
title: Restore archived tasks to the board
status: To Do
assignee: []
created_date: '2026-10-11 13:02'
labels:
  - enhancement
dependencies:
  - BACK-730
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1064'
priority: high
type: enhancement
ordinal: 349000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1064 reports that finished work taken off the board can still be viewed but can no longer be edited or returned to the board (reproduced on 1.53.0). Editing such a task answers that the task was not found, and no command leads back, so the only way out is editing task files by hand, which the shipped guidance forbids.

BACK-719 makes archive the single way off the board and keeps the task ID, but it does not add a way back. Restore is the supported way back. Archived tasks stay read-only, so changing one means restoring it first.

The CLI is the canonical surface for restore. An MCP equivalent is planned alongside it and is confirmed on the pull request. If it is declined, the MCP criterion is dropped.

Depends on BACK-730: the lifecycle change is delivered in order, first the single archive flow (BACK-719), then delete (BACK-730), then restore.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog task restore <id>` on an archived task exits zero and moves the task back to the board with the same ID.
- [ ] #2 A restored task behaves like any other task on the board: `backlog task list` shows it and `backlog task edit <id>` changes it.
- [ ] #3 Archived tasks stay read-only: `backlog task edit <id>` on an archived task exits non-zero, leaves the task unchanged, and prints a message that names the restore command instead of reporting that the task was not found.
- [ ] #4 The MCP server offers the same operation.
- [ ] #5 Command help and the shipped instruction guides (`backlog instructions`) describe how to bring archived work back to the board.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
