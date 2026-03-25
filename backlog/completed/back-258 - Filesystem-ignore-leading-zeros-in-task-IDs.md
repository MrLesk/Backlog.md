---
id: BACK-258
title: 'Filesystem: ignore leading zeros in task IDs'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-06 23:24'
updated_date: '2025-09-06 23:24'
labels:
  - filesystem
  - cli
dependencies: []
priority: high
---

## Description

Implement a reusable task ID parser in filesystem resolvers so that numeric equivalence is used when matching task IDs, ignoring leading zeros.

- Match task-0001 when user inputs 1 and vice versa
- Apply to tasks and drafts; supports dotted IDs (e.g. 3.01 == 3.1)
- Do not change ID generation or filenames; only resolution
- Behavior independent of zeroPaddedIds width

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task operations ignore leading zeros: view/edit/archive/demote accept padded/non-padded IDs equally for tasks and drafts.
- [x] #2 Dotted IDs compare by numeric segments: 3.01 == 3.1, preserving suffixes and titles.
- [x] #3 Feature works regardless of config zeroPaddedIds (tested with 3 and 0).
- [x] #4 No change to ID generation or saved filenames; only resolver behavior updated.
- [x] #5 Tests added and passing; type-check and lint pass.
<!-- AC:END -->


## Implementation Notes

Implementation Summary:

- Added numeric, zero-padding-agnostic ID parsing for filesystem resolvers in src/utils/task-path.ts.
  - New helpers: parseIdSegments(), extractSegmentsFromFilename(), idsMatchLoosely()
  - Updated getTaskPath/getTaskFilename/getDraftPath to fall back to loose numeric matching.
- Added tests validating padded/unpadded and dotted IDs in src/test/task-path.test.ts.
- Verified full test suite passes with zeroPaddedIds=3 and with zeroPaddedIds=0 (via CLI config set).
- No changes to ID generation or file naming; only resolution behavior.
- Lint and type-check pass.

Validation steps performed:
1) bun test (all passing)
2) bun run cli config set zeroPaddedIds 0
3) bun test (all passing)
4) bun run cli config set zeroPaddedIds 3
5) bunx tsc --noEmit && bun run check .
