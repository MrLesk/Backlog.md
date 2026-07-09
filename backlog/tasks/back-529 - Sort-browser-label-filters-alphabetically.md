---
id: BACK-529
title: Sort browser label filters alphabetically
status: Done
assignee:
  - '@codex'
created_date: '2026-07-09 06:09'
updated_date: '2026-07-09 06:14'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/733'
modified_files:
  - src/utils/label-filter.ts
  - src/test/label-filter.test.ts
  - src/test/web-task-list-labels-menu.test.tsx
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #733 reports that the Web UI All Tasks Labels dropdown shows labels in creation/configuration order rather than alphabetical order. The browser label filter menu should present labels lexicographically so users can scan and select labels predictably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The All Tasks Labels dropdown renders available labels in alphabetical/lexicographic order regardless of task creation order.
- [x] #2 Label sorting is case-insensitive and deterministic for configured labels and labels discovered from tasks.
- [x] #3 A Web UI regression test covers unordered input labels rendering alphabetically in the Labels dropdown.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a focused Web UI regression test showing unordered configured/task labels render in the All Tasks Labels dropdown in the wrong order.
2. Sort de-duplicated available labels case-insensitively in the shared label filter utility used by the browser task list and board filters.
3. Run targeted label/Web tests, type-check, Biome, and the full Bun test suite before publishing the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced issue #733 with a focused TaskList Web UI test: before the fix, the Labels dropdown rendered zeta before Alpha because available labels preserved insertion order. Updated collectAvailableLabels to sort de-duplicated labels case-insensitively while preserving first-seen casing. Validation passed: bun test src/test/web-task-list-labels-menu.test.tsx src/test/label-filter.test.ts; bunx tsc --noEmit; bun run check .; bun test (1447 pass, 2 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed browser label filter ordering by sorting collected label options alphabetically in the shared label utility used by the All Tasks and board label dropdowns. Added a Web UI regression test for unordered configured/task labels and updated utility test coverage; targeted checks, type-check, Biome, and the full Bun test suite pass.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
