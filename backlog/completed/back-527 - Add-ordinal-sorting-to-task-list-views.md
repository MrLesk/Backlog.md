---
id: BACK-527
title: Add ordinal sorting to task list views
status: Done
assignee:
  - '@Codex'
created_date: '2026-07-08 20:33'
updated_date: '2026-07-08 20:34'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/645'
  - 'https://github.com/MrLesk/Backlog.md/issues/643'
modified_files:
  - src/web/components/TaskList.tsx
  - src/cli.ts
  - src/test/cli-task-list-ordinal-sort.test.ts
  - src/test/web-task-list-labels-menu.test.tsx
  - src/test/cli-priority-filtering.test.ts
  - src/test/cli.test.ts
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The browser task list and CLI list commands should expose ordinal sorting so users can review tasks in the same deliberate sequence used by the board view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The browser task list exposes a sortable ordinal column.
- [x] #2 CLI task and draft list commands accept --sort ordinal.
- [x] #3 Focused CLI and browser tests pass for ordinal sorting behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebase the PR branch onto latest main.
2. Add ordinal as a supported browser list sort column.
3. Add ordinal as a valid CLI list sort field and update help text.
4. Add focused tests for browser and CLI ordinal sorting.
5. Run focused and full validation before handoff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in PR #645. Updated src/web/components/TaskList.tsx, src/cli.ts, and focused CLI/Web tests.

Validation on the rebased branch passed: bun test --timeout=10000 src/test/cli-task-list-ordinal-sort.test.ts src/test/cli-priority-filtering.test.ts src/test/web-task-list-labels-menu.test.tsx (19 pass, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PR #645 adds ordinal sorting to the browser task list and CLI list commands, with focused tests for ordinal column rendering, sort behavior, and CLI sort validation.
<!-- SECTION:FINAL_SUMMARY:END -->
