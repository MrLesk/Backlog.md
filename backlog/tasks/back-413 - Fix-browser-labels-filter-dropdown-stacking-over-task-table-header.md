---
id: BACK-413
title: Fix browser labels filter dropdown stacking over task table header
status: Done
assignee:
  - '@codex'
created_date: '2026-04-13 16:05'
updated_date: '2026-04-13 16:10'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/592'
  - 'https://github.com/MrLesk/Backlog.md/issues/592#issuecomment-4204881606'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the browser task list so the Labels filter dropdown remains fully visible and readable when opened above the task table. This addresses GitHub issue #592, where the dropdown is rendered behind the sticky table header and options become partially hidden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening the Labels filter in the browser task list renders the dropdown above the sticky task table header so all options remain visible and readable.
- [x] #2 The labels filter remains usable after the fix, including selecting labels and clearing the filter.
- [x] #3 A regression test covers the browser task list labels filter stacking behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update the browser task list labels filter popover in src/web/components/TaskList.tsx so it stacks above the sticky task table header while keeping the existing labels selection and clear-filter behavior intact.
2. Add a focused web regression test that renders TaskList, opens the labels menu, and verifies the popover uses a higher stacking level than the sticky header and still exposes label options.
3. Run validation for the change set with a scoped web test, bunx tsc --noEmit, and bun run check .; capture results and finalize the task if all acceptance criteria are met.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Raised the TaskList labels popover above the sticky table header by increasing the menu stacking level and added explicit menu accessibility attributes on the trigger and popover.

Added a focused JSDOM regression test for the TaskList labels menu that verifies the popover stacks above the sticky header and that a preselected label filter can be cleared through the UI.

Validation: `bun test src/test/web-task-list-labels-menu.test.tsx` passed and `bunx tsc --noEmit` passed. `bun run check .` still fails on an unrelated existing `package.json` formatting issue in the repository baseline.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Raised the browser TaskList labels filter popover above the sticky task table header by changing the popover to a higher z-index and adding explicit menu accessibility attributes to the labels filter trigger and menu. Added a focused JSDOM regression test that opens the labels menu, verifies it stacks above the sticky header, and confirms a preselected label filter can be cleared through the UI.

Validation run:
- `bun test src/test/web-task-list-labels-menu.test.tsx`
- `bunx tsc --noEmit`

Known validation caveat:
- `bun run check .` still fails because `package.json` is not formatted to the current Biome style in the existing repository baseline; this issue is unrelated to the TaskList fix.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
