---
id: BACK-572
title: Clear task dependencies through the CLI
status: Done
assignee:
  - '@codex'
created_date: '2026-08-03 20:16'
updated_date: '2026-08-03 20:27'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/839'
priority: medium
type: bug
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix GitHub issue #839: task edit currently ignores an empty dependency value, reports success without changing the task, and offers no supported way to remove dependencies. Add a clear, consistent CLI workflow without allowing silent no-op edits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task edit --clear-deps removes all dependencies from an existing task
- [x] #2 --clear-deps cannot be combined with --depends-on or --dep and does not mutate the task on invalid input
- [x] #3 Empty --depends-on or --dep is rejected instead of reporting a successful no-op
- [x] #4 CLI help and regression tests document and verify dependency clearing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a clear-dependencies edit input that follows the existing clear-* validation pattern.
2. Reject empty dependency flag values before constructing an edit, preventing false-success output.
3. Cover clear, conflicting, and empty-value behavior at the CLI surface; run focused and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented --clear-deps with matching conflict and empty-value validation. Verified with bun test src/test/cli-dependency.test.ts, bunx tsc --noEmit, bun run check ., and bun test (1880 passed, 5 skipped).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added task edit --clear-deps and rejected empty dependency values to prevent false-success edits. Verified by focused CLI regression coverage, type-check, Biome, and the full Bun suite (1880 passed, 5 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
