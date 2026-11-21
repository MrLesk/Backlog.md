---
id: BACK-815
title: Keep release CI reliable across task renames and decision edits
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T00:02:27Z'
updated_date: '2026-11-21T00:17:07Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/actions/runs/44838950003
  - src/test/content-frontmatter-preservation.test.ts
  - src/test/duplicate-task-repair.test.ts
modified_files:
  - src/test/content-frontmatter-preservation.test.ts
  - src/test/duplicate-task-repair.test.ts
priority: high
type: bug
ordinal: 414000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The main Linux suite failed when two decision edits crossed a second. The Windows suite observed both the pre-edit and new task title during a rename by a separate CLI. A release needs evidence that distinguishes a valid timestamp advance and an in-progress file change from an incorrect final result.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision status edit preserves all other Markdown and records the new update second when the clock advances.
- [x] #2 An open board with branches cached keeps one resolved task through a CLI title edit and observes the correct saved title, including when filesystem events arrive between steps of the write.
- [x] #3 The relevant Windows and Linux CI tests pass and cover the timing that caused the main runs to fail.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the status edit across two known seconds and trace notifications during a separate CLI title change. 2. Keep the decision test's byte-preservation guarantee while accounting for its new update time. Correct any observable rename race at the owning layer and cover it with deterministic timing. 3. Run the affected tests, type and style checks, then verify Linux, Windows, macOS and packaging in CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Linux's raw decision files differed only in the valid update timestamp, one second apart. Freezing the two HTTP edits in 2020 reproduced the old failure consistently. For the CLI retitle, a diagnostic held the content write after the filesystem rename. The live board reported Original while the renamed file still contained Original, then Renamed after the file contained Renamed. The test now requires exactly that visible transition and rejects incorrect intermediate states or a return to an old title.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified that a decision edit advances its timestamp while preserving every other byte, and that the board keeps one resolved task throughout a CLI file rename. Both failures were reproduced with controlled timing. The affected suites passed locally (49 tests), as did the type and style checks. GitHub CI passed on Linux, Windows and macOS, with all six binary builds and Nix packaging passing: https://github.com/MrLesk/Backlog.md/actions/runs/44841968122
<!-- SECTION:FINAL_SUMMARY:END -->
