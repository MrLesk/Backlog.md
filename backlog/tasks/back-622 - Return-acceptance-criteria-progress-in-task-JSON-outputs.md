---
id: BACK-622
title: Return acceptance criteria progress in task JSON outputs
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 21:52'
updated_date: '2026-08-10 05:30'
labels: []
dependencies: []
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/formatters/json-output.ts
  - src/test/cli-json-output.test.ts
ordinal: 260000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Machine-readable task summaries currently omit acceptance-criteria progress, so consumers must load and inspect full checklist data. Return the completed acceptance-criteria count and total acceptance-criteria count consistently anywhere the canonical CLI emits task list or task detail JSON, including task results in search output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task list JSON includes completed and total acceptance-criteria counts for every task summary
- [x] #2 Task detail JSON includes the same acceptance-criteria counts alongside the full checklist
- [x] #3 Task results in search JSON use the same acceptance-criteria count fields as task list output
- [x] #4 Tasks without acceptance criteria return zero for both counts
- [x] #5 Focused automated tests cover complete, partial, and empty acceptance-criteria progress
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the shared task summary JSON formatter with additive schema-v1 fields `acceptanceCriteriaCompleted` and `acceptanceCriteriaCount`, deriving both from structured checklist items and defaulting to 0/0.
2. Update the stable JSON contract documentation so list, task search, and detail semantics are explicit.
3. Add focused CLI integration assertions proving complete, partial, and empty progress across task list, task detail/shorthand, and task search; then run the focused JSON/guidance tests, TypeScript, Biome, and diff checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented both counts in the shared task-summary JSON serializer, which is reused by list, detail, and task search. Kept schemaVersion 1 because the fields are backward-compatible additions and documented their stable semantics, including 0/0 for empty checklists.

Validation: `bun test --timeout=10000 src/test/cli-json-output.test.ts src/test/cli-guidance.test.ts` passed 30 tests with 372 assertions; `bunx tsc --noEmit`, `bun run check .`, and `git diff --check` passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `acceptanceCriteriaCompleted` and `acceptanceCriteriaCount` to every canonical task JSON summary and task detail while preserving the full checklist. Documented the additive schema-v1 contract and verified complete, partial, and empty progress across list, view/shorthand, and search with 30 passing focused tests, TypeScript, Biome, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
