---
id: BACK-515
title: Fix TUI completion status update
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-07-01 17:57'
updated_date: '2026-07-04 17:45'
labels:
  - bug
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/697'
modified_files:
  - src/ui/task-lifecycle.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/tui-task-lifecycle.test.ts
priority: medium
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate GitHub Issue #697: TUI Mark as completed reportedly moves a task into completed/ without setting the task status to Done. If current, implement the smallest current-project-scope fix and focused regression tests for completion/archive behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TUI Mark as completed does not move non-terminal tasks into completed/.
- [x] #2 TUI Mark as completed still moves terminal-status tasks into completed/.
- [x] #3 Related archive/completion behavior is checked for regressions without broad temporal-model changes.
- [x] #4 Focused tests cover the fixed behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read GitHub Issue #697 and identify reported repro.
2. Trace TUI completion and archive paths plus nearest tests.
3. Reproduce locally with the smallest CLI/TUI-callable path.
4. If current, apply a narrow fix and focused regression tests.
5. Run targeted tests plus type/check as appropriate, update task, and open a PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced Issue #697 by calling the same low-level complete path previously used by the TUI: a To Do task was removed from active tasks and appeared in completed/ with status still To Do.
Implemented a TUI-only guard so completion requires the configured terminal status before moving the task. Left the lower-level completion move intact for cleanup and already-terminal callers.
Validation: bun test src/test/cleanup.test.ts src/test/mcp-task-complete.test.ts src/test/tui-task-lifecycle.test.ts; bunx tsc --noEmit; bunx biome check touched files. Full bun run check . currently fails only on unrelated untracked onionskin.config.json formatting. Full bun test had unrelated failures in cli-priority-filtering 5s timeout and mcp-documents timestamp expectation; mcp-documents passed in isolation, and cli-priority-filtering passed with --timeout 10000.

Takeover verification (@alex-agent): fix confirmed merged to main via PR #708 (merge commit cdf9a28); issue #697 closed. Re-verified on main: bun test src/test/tui-task-lifecycle.test.ts (3 pass), bunx tsc --noEmit clean, and no remaining direct core.completeTask calls in src/ui outside the completeTaskFromTui guard. bun run check . passes at d0f3cff (306 files) when run from a path outside .claude (worktree path collides with the biome !**/.claude ignore).

Full-suite verification on rebased branch (origin/main d0f3cff + ledger-only commit): bun test ran 1381 tests, 1367 pass / 2 skip / 12 fail. All 12 failures verified unrelated: 11 cli-priority-filtering failures were caused by missing @tailwindcss/cli in the worktree node_modules (fixed by bun i; then 10/11 pass, and the last one is the documented 5s-timeout flake that fails identically on a pristine main clone and passes 11/11 with --timeout 15000). The single server-search-endpoint failure (persists milestone via POST) passes scoped 19/19. Scoped fix coverage src/test/tui-task-lifecycle.test.ts: 3/3 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a shared TUI completion guard (completeTaskFromTui in src/ui/task-lifecycle.ts) and wired both board and task-list completion shortcuts through it. Non-terminal tasks now stay active with an explanatory message; terminal-status tasks still move to completed/. Focused regression coverage in src/test/tui-task-lifecycle.test.ts covers default and custom terminal statuses. Fix merged to main via PR #708 (commit cdf9a28), closing issue #697; verified on main with the regression tests, tsc, and biome.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
