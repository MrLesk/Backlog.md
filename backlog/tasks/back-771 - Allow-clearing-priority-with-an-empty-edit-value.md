---
id: BACK-771
title: Allow clearing priority with an empty edit value
status: Done
assignee:
  - '@fabit'
created_date: '2026-10-18 09:24'
updated_date: '2026-10-18 09:33'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/test/cli-task-view-edit.test.ts
  - src/test/cli-draft-edit.test.ts
modified_files:
  - src/cli.ts
  - src/test/cli-task-view-edit.test.ts
  - src/test/cli-draft-edit.test.ts
type: enhancement
ordinal: 391000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once a task priority is set, the CLI task-edit command has no supported way to unset it, even though the shared update model normalizes an empty priority to no value. Users and scripts should be able to clear a priority without using the GUI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task edit with an explicitly empty priority clears a previously set priority, while omitting the option preserves it.
- [x] #2 Non-empty priorities continue to be validated against configured priority values.
- [x] #3 Task and draft edit help explain that an empty priority value clears it.
- [x] #4 Tests cover clearing priority through the CLI, including the shared draft-edit path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Distinguish an explicitly empty --priority value from an omitted option; preserve validation for non-empty configured priorities.
2. Pass the empty string through the existing update builder, which the core priority normalizer treats as unset; do not add a clear flag or change the update model.
3. Document empty-value behavior in task and draft edit help.
4. Add CLI tests for task clearing, omitted-option preservation, invalid non-empty values, and draft clearing.
5. Run focused CLI tests and project checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused CLI tests passed (53 pass, 1 skip); type-check passed; Biome check passed. Verification used Bun 1.4.3 via npx and a temporary Git compatibility shim because system Bun 1.0 and Git 2.25 lack required features.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task and draft edit now treat an explicit blank --priority as a clear while omitted priority preserves existing values; invalid non-empty priorities remain validated. Updated CLI help metadata and added regression tests. Focused tests, type-check, and Biome checks pass.
<!-- SECTION:FINAL_SUMMARY:END -->
