---
id: BACK-507.10
title: Task complete CLI parity with MCP cleanup operation
status: Done
assignee:
  - '@gpt-5.5-xhigh'
created_date: '2026-06-13 21:15'
updated_date: '2026-06-13 21:20'
labels: []
dependencies: []
modified_files:
  - src/cli.ts
  - src/test/cli.test.ts
parent_task_id: BACK-507
priority: high
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an explicit CLI command for the MCP task_complete operation so CLI users can move one Done task into the completed folder when they intentionally want cleanup behavior. This command is dangerous because completed tasks disappear from the active Kanban board, so it must be positioned as a cleanup/archive-style operation, not as the normal way to finalize task work. Do not add this command to the new CLI workflow instruction guides or generated agent nudge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task complete <taskId> moves a Done task to the completed folder using behavior equivalent to MCP task_complete.
- [x] #2 The command refuses non-Done tasks with an actionable message telling users to set status Done before cleanup.
- [x] #3 backlog task complete --help clearly warns that this is a cleanup procedure, removes the task from the active Kanban board, and should only be used for cleanup/archive purposes.
- [x] #4 The command is not mentioned in the new CLI instruction guides, generated agent nudge, or overview workflow as a normal finalization step.
- [x] #5 Tests cover successful completion cleanup, rejection of non-Done tasks, help warning copy, and absence from the new CLI instruction guides.
- [x] #6 Existing cleanup behavior and task finalization instructions remain unchanged.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing MCP `task_complete`, core `completeTask`, CLI task command conventions, help schema rendering, and nearby CLI tests.
2. Add a `backlog task complete <taskId>` subcommand in `src/cli.ts` near `task archive`, with help schema warning that it is cleanup/archive behavior and removes tasks from the active Kanban board.
3. Reuse existing core completion semantics and validation: require a local editable task and require Done/complete-style status before moving it to `backlog/completed/`; emit concise actionable errors.
4. Add CLI integration coverage for successful single-task cleanup, non-Done rejection, help warning copy, and absence from new CLI instruction/nudge/workflow guidance.
5. Run focused tests, `bunx tsc --noEmit`, and `bun run check .`; update task notes/AC/DoD/final summary via Backlog MCP.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `backlog task complete <taskId>` as an explicit cleanup/archive-style CLI command. It validates local editable tasks, refuses non-Done statuses with an actionable `backlog task edit <id> -s Done` message, then delegates the move to `Core.completeTask` to match MCP `task_complete` cleanup semantics. Help text includes a strong warning that the task disappears from the active Kanban board and should only be used for cleanup/archive purposes. Added CLI integration coverage for successful cleanup, non-Done rejection, warning help copy, and absence from the CLI workflow guides/generated agent nudge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `backlog task complete <taskId>` to the task command group as a cleanup/archive-only operation. The command mirrors MCP `task_complete` behavior by requiring a local editable Done/complete-style task before calling `Core.completeTask`, reports an actionable status fix for non-Done tasks, and warns in command help that this removes the task from the active Kanban board. Added focused CLI tests for success, rejection, help warning copy, and ensuring the command is not recommended in CLI instruction guides or the generated agent nudge.

Verification passed: `bun test src/test/cli.test.ts --test-name-pattern "complete|task command field types"`, `bunx tsc --noEmit`, and `bun run check .`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
