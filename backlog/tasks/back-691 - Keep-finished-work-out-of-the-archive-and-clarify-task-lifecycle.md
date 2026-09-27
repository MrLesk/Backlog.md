---
id: BACK-691
title: Keep finished work out of the archive and clarify task lifecycle
status: Done
assignee:
  - '@codex-lifecycle'
created_date: '2026-09-27 21:48'
updated_date: '2026-09-27 21:59'
labels: []
dependencies: []
modified_files:
  - CLI-INSTRUCTIONS.md
  - README.md
  - src/cli.ts
  - src/core/backlog.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/task-finalization.md
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/tools/tasks/index.ts
  - src/server/index.ts
  - src/test/board-popup-sync.test.ts
  - src/test/cli-guidance.test.ts
  - src/test/cli-task-state.test.ts
  - src/test/mcp-server.test.ts
  - src/test/mcp-task-complete.test.ts
  - src/test/server-cleanup-endpoint.test.ts
  - src/test/vacated-task-references.test.ts
  - src/test/web-task-details-modal-keyboard-shortcuts.test.tsx
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/web/components/TaskDetailsModal.tsx
priority: high
type: bug
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI and MCP reject archiving finished tasks, but the browser archive endpoint accepts them and the TUI uses the same unchecked core path. Help calls completion cleanup/archive, while the main task command table omits Complete. Alex confirmed that finished work belongs in completed storage, and requested shorter, clearer guidance for humans and agents.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Archiving a task in the configured final status is rejected by the shared core before any move or dependency cleanup, with guidance to use Complete.
- [x] #2 CLI, TUI, browser, and MCP follow the same completion-versus-archive rule without duplicate eligibility rules in adapters.
- [x] #3 Completion labels and help describe moving already finished work to completed storage; archive wording identifies canceled, duplicate, or invalid work and its link cleanup.
- [x] #4 Canonical workflow guidance states that finished work is marked Done and moved to completed storage during cleanup; command references show Complete beside Archive.
- [x] #5 Overview and finalization guidance are shorter overall by removing repeated or misplaced detail while preserving verification and review requirements.
- [x] #6 Focused regression checks verify the shared rejection through public interfaces and the normal completion and archive flows.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Put final-status archive rejection in Core before archive paths or reference cleanup, and translate that shared error through MCP and HTTP while removing adapter eligibility checks.
2. Clarify Complete and Archive help, confirmations, and configured-final-status browser visibility; shorten CLI/MCP overview and finalization guidance while retaining verification, review, and public contracts.
3. Add regression coverage for rejected archives with intact records and links, configured statuses, and public CLI/MCP/HTTP behavior; run existing completion/archive and UI checks.
4. Run TypeScript and Biome, review and simplify the diff, record evidence and modified files, and leave the task In Progress for coordinator review.

5. After coordinator review, mark the verified task Done, commit its scoped files and task record, and push shared main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the shared archive rule in Core. Archive re-reads the task inside the existing cleanup lock and rejects the configured final status before moving files or writing reference cleanup. CLI and MCP no longer own duplicate archive eligibility checks. HTTP returns 400 and MCP returns VALIDATION_ERROR with Complete guidance; TUI reports the shared error.

Updated Complete/Archive help, browser and TUI labels/confirmations, the CLI command table, and README lifecycle guidance. The browser uses configured final-status matching instead of a Done substring. TUI confirmations fit the existing three-line popup. Finished records and dependency links remain preserved by Complete; ordinary archive still cleans incoming links and archived ID reuse stays unchanged.

Verification: 165 tests passed across vacated-task-references, cli-task-state, mcp-task-complete, server-cleanup-endpoint, cli-guidance, mcp-server, board-popup-sync, web-task-details-modal-keyboard-shortcuts, core, id-generation, and local-task-command-performance. Final UI rerun: 20 tests passed across board-popup-sync, web-task-details-modal-keyboard-shortcuts, and tui-task-lifecycle. Other related suites also passed during the first focused run: auto-commit, agent-instructions, cleanup, and dependency. bunx tsc --noEmit, bun run check ., and git diff --check pass.

Regression evidence: Core rejects Done and custom Closed with byte-identical target, active dependent, and completed dependent records; HTTP rejects Closed and preserves links, then Complete succeeds; MCP rejection remains VALIDATION_ERROR and preserves links. A deterministic concurrent Done edit initially reproduced archive succeeding before its lock; moving the guard inside the existing lock makes that test pass.

Guidance word counts (before -> after): CLI overview 557 -> 285; CLI finalization 397 -> 263; MCP overview 756 -> 497; MCP tools overview 614 -> 414; MCP finalization 628 -> 238. Total 2,952 -> 1,697, a 43% reduction. Required verification and user review remain explicit.

Subtraction review: one shared eligibility guard, one typed error reused by adapters, no new lock architecture or helper layer. No unresolved product choices. Left In Progress for coordinator review; no commit, push, or public action.

Coordinator contextual architecture review accepted the implementation exactly as written, with no blockers or advisory changes. Approved finalization: mark Done, then commit and push only this task scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Core now rejects archiving finished tasks inside the existing task lock, preserving records and incoming links. CLI and MCP use the shared rule; browser and TUI receive the same rejection. Help, confirmations, and lifecycle guides distinguish Done, periodic Complete cleanup, and Archive for canceled, duplicate, or invalid work. Guidance is 43% shorter. Verified with 165 focused tests, 20 final UI tests, TypeScript, Biome, and a deterministic lock-race regression. Contextual architecture review passed without changes.
<!-- SECTION:FINAL_SUMMARY:END -->
