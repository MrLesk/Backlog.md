---
id: BACK-790
title: Repair duplicate task IDs with long filenames
status: Done
assignee:
  - '@codex'
created_date: '2026-10-25T19:33:00Z'
updated_date: '2026-10-25T19:35:00Z'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1134'
  - src/core/duplicate-task-repair.ts
  - src/test/duplicate-task-repair.test.ts
modified_files:
  - src/test/duplicate-task-repair.test.ts
  - src/core/duplicate-task-repair.ts
priority: high
type: bug
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Doctor repair adds temporary suffixes to full task filenames, so a valid filename near the filesystem limit makes the repair fail with ENAMETOOLONG. Issue #1134 requests a bounded repair that supports these existing records while retaining rollback and no-replace safety.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Duplicate-ID repair succeeds for valid task filenames close to the filesystem filename limit.
- [x] #2 A failed repair restores original long-named records and preserves concurrently created files.
- [x] #3 Successful repair and normal rollback leave no temporary transaction files behind.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce repair failure with a duplicate whose valid filename is near the filename limit, including rollback after a later install failure.
2. Keep temporary and backup names short in their current directories, preserving transaction staging, no-replace installation and ownership-safe rollback.
3. Run the repair and doctor suites, type/lint/build checks; review correctness and maintainability, then open a focused PR for #1134.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before the fix, both the near-limit filename repair and long-filename rollback regression failed with ENAMETOOLONG during staging. Transaction files now use short sibling names; existing rollback and backup recovery tests were updated for those internal names.

The near-limit repair and concurrent-writer rollback regressions pass after shortening both staging and backup filenames. Existing recovery safety remains in its current implementation. Type checking, Biome, build and diff checks passed. A subtraction pass retained only two path changes and the explanatory filename-limit comment.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Doctor duplicate-ID repair now uses short sibling transaction names, so valid long task filenames no longer exceed the filename limit during staging or backup. Regressions cover successful repair, byte-preserving rollback and a concurrent destination winner; existing recovery tests remain in place. Types, lint and build passed.
<!-- SECTION:FINAL_SUMMARY:END -->
