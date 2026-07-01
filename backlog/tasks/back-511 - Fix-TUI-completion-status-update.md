---
id: BACK-511
title: Fix TUI completion status update
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-01 17:57'
updated_date: '2026-07-01 18:11'
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a shared TUI completion guard and wired both board and task-list completion shortcuts through it. Non-terminal tasks now stay active with an explanatory message; terminal-status tasks still move to completed/. Added focused regression coverage for default and custom terminal statuses.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
