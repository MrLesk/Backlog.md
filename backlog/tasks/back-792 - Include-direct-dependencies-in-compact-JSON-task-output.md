---
id: BACK-792
title: Include direct dependencies in compact JSON task output
status: Done
assignee:
  - '@codex'
created_date: '2026-10-25T19:45:00Z'
updated_date: '2026-10-25T20:02:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1035'
  - src/formatters/json-output.ts
  - src/test/cli-json-output.test.ts
  - src/test/cli-json-watch.test.ts
  - CLI-INSTRUCTIONS.md
modified_files:
  - src/test/cli-json-output.test.ts
  - src/formatters/json-output.ts
  - src/test/cli-json-watch.test.ts
  - CLI-INSTRUCTIONS.md
  - src/test/cli-dependency-graph.test.ts
priority: medium
type: enhancement
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consumers building dependency views currently need one task-view process per task because list and search JSON omit the stored dependency IDs. Issue #1035 is accepted here for dependencies only. Reuse the existing compact serializer and keep content-version, full-body and bulk-view proposals outside this change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task list and task search JSON include each task’s stored direct dependency IDs in a dependencies array.
- [x] #2 Records without dependencies expose an empty array, and other compact fields and output modes keep their existing behavior.
- [x] #3 JSON watch snapshots include dependency edits, and the shipped JSON field documentation describes the array.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the real CLI list/search JSON expectations and watch dependency-edit regression, confirming the missing field fails first.
2. Add dependencies to the existing compact stored-field serializer, removing redundant detail serialization and retaining default empty arrays.
3. Document the additive field, run JSON/list/watch/readiness suites and type/lint/build checks, then review and merge a focused PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The three real CLI checks failed before the change: task list and search omitted dependencies and an empty dependency list was undefined. The existing compact serializer now emits the stored array once for all compact records; the redundant detail field/type was removed. Watch coverage checks stored IDs and a clear-to-empty edit.

All 60 JSON, watch, pagination and cross-surface search tests pass. Types, Biome, build and diff checks pass. The maintenance pass keeps dependencies in the existing shared compact serializer, uses [] for absent lists, and removes the redundant detail-only type/property assignments. No new loader, query or content-version API is introduced.

Full Linux CI exposed an older dependency-graph test that explicitly forbade direct dependency IDs in compact output. Updated it to require stored direct IDs and empty arrays while retaining the assertion that compact output excludes the full graph. This aligns the existing graph coverage with the accepted JSON output contract.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compact JSON output now includes stored direct dependency IDs, defaulting to an empty array. Task list, search and watch share the existing serializer, as do draft list entries. Added list/search/default/watch coverage and documented the field. All 60 focused tests, types, lint and build passed.
<!-- SECTION:FINAL_SUMMARY:END -->
