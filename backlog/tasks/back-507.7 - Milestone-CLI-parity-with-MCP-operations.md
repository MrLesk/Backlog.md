---
id: BACK-507.7
title: Milestone CLI parity with MCP operations
status: Done
assignee:
  - '@gpt-5.5-xhigh'
created_date: '2026-06-13 21:12'
updated_date: '2026-06-13 21:19'
labels: []
dependencies: []
modified_files:
  - src/cli.ts
  - src/test/cli-milestone-management.test.ts
  - CLI-INSTRUCTIONS.md
  - README.md
  - src/guidelines/cli-instructions/overview.md
  - src/test/cli-doc-search.test.ts
parent_task_id: BACK-507
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add non-interactive CLI commands for milestone add, rename, and remove so CLI users and agents can perform the same milestone management operations currently exposed through MCP. Keep behavior aligned with the existing MCP handlers/schemas for validation, task reassignment, archived milestone handling, and error messages where practical. Update command help and public docs so agents can discover these operations from the CLI surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog milestone add <name> creates a milestone file with optional description and validates duplicates consistently with MCP milestone_add.
- [x] #2 backlog milestone rename <from> <to> supports the MCP updateTasks behavior, defaults to updating local tasks, and exposes a clear CLI flag for disabling task updates.
- [x] #3 backlog milestone remove <name> supports clear, keep, and reassign task-handling modes, including validation for required reassign targets.
- [x] #4 Milestone command help includes input schema sections, read/write behavior, outputs, and examples for add, rename, remove, list, and archive.
- [x] #5 Tests cover CLI add/rename/remove success paths, validation failures, task reference updates, and parity with MCP milestone handler behavior.
- [x] #6 README or CLI reference docs mention the new milestone commands where milestone management is documented.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing milestone MCP handlers, core milestone/task helpers, CLI command patterns, help text conventions, and CLI milestone tests to identify reusable behavior.
2. Add non-interactive `milestone add`, `milestone rename`, and `milestone remove` commands in `src/cli.ts`, delegating to the same core milestone operations used by MCP where possible.
3. Expand milestone command help with schema/read-write/output/example sections for add, rename, remove, list, and archive.
4. Add focused CLI tests covering success paths, validation failures, task updates, and behavior parity with MCP milestone handlers.
5. Update public docs for milestone management commands.
6. Run focused milestone CLI tests, `bunx tsc --noEmit`, and `bun run check .`; then check acceptance criteria, final summary, and mark the task Done if all pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation for BACK-507.7. The task is already In Progress and assigned to @gpt-5.5-xhigh; recorded the implementation plan before code changes.

Discovery: CLI milestone list/archive are in src/cli.ts; MCP add/rename/remove behavior is centralized in src/mcp/tools/milestones/handlers.ts with the needed alias, archived milestone, task update, and auto-commit handling. Chosen approach is to delegate new CLI mutation commands to MilestoneHandlers rather than duplicate that logic.

Implemented milestone CLI parity by routing `backlog milestone add`, `rename`, `remove`, and `archive` through the existing MilestoneHandlers so duplicate/alias validation, task update behavior, archived milestone handling, auto-commit staging, and error text stay aligned with MCP behavior. Added focused CLI tests and public docs. Verification passed: `bun test src/test/cli-milestone-management.test.ts`; `bun test src/test/cli-milestone-management.test.ts src/test/cli-task-milestone.test.ts src/test/cli-milestone-filter.test.ts src/test/mcp-milestones.test.ts`; `bunx tsc --noEmit`; `bun run check .`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented non-interactive CLI milestone management parity with the existing MCP milestone operations. `backlog milestone add`, `rename`, and `remove` now exist under the milestone command group, with rename defaulting to local task updates and `--no-update-tasks` available, and remove supporting `--task-handling clear|keep|reassign` plus `--reassign-to` validation. The commands delegate to the existing milestone handler logic to keep validation, task reference updates, archived milestone behavior, and output aligned with MCP.

Updated milestone help schemas, CLI reference docs, README quick examples, and CLI workflow overview guidance. Added a focused CLI milestone management test suite covering add/rename/remove success paths, validation failures, task updates, help schema output, and direct MCP handler output parity. Also applied a small Biome regex lint fix in `src/test/cli-doc-search.test.ts` required for `bun run check .`.

Verification passed: `bun test src/test/cli-milestone-management.test.ts`; `bun test src/test/cli-milestone-management.test.ts src/test/cli-task-milestone.test.ts src/test/cli-milestone-filter.test.ts src/test/mcp-milestones.test.ts`; `bunx tsc --noEmit`; `bun run check .`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
