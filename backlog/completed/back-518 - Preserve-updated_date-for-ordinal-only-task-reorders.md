---
id: BACK-518
title: Preserve updated_date for ordinal-only task reorders
status: Done
assignee:
  - '@codex'
created_date: '2026-07-02 20:39'
updated_date: '2026-07-02 20:46'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/684'
priority: high
ordinal: 113000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Editing only a task ordinal preserves the existing updated_date value
- [x] #2 Editing only a task ordinal does not add updated_date when it was absent
- [x] #3 Saving ordinal changes together with any non-order task field updates updated_date normally
- [x] #4 Board reorder and sort bulk flows preserve updated_date for ordinal-only changes
- [x] #5 Focused regression tests cover direct and bulk reorder behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Centralize updated_date stamping in Core.updateTask so ordinal-only saves restore the prior updatedDate instead of stamping now.
2. Add focused regression coverage for direct ordinal edits, direct ordinal plus content edits, updateTasksBulk ordinal-only saves, and reorderTask same-column reorders.
3. Run targeted tests, typecheck, and Biome checks for touched files; update Backlog task status/acceptance criteria before commit/PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented timestamp preservation in Core.updateTask by comparing persisted task fields excluding ordinal and updatedDate. Validation passed: bun test src/test/reorder-utils.test.ts; bunx tsc --noEmit; bun run check .; bun test (1379 pass, 2 skip).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved updated_date for ordinal-only task saves across direct edits, bulk updates, and same-column reorder flows while keeping normal updated_date stamping for ordinal plus content/metadata edits. Added focused regression coverage and verified with targeted tests, typecheck, Biome, and the full test suite.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
