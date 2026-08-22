---
id: BACK-638
title: Allow task list --status to accept several statuses
status: Done
assignee:
  - '@MrLesk'
created_date: '2026-08-22 12:22'
updated_date: '2026-08-22 12:50'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/929'
ordinal: 273000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the task list --status flag accept repeated values and comma-separated values (OR semantics), matching --exclude-status and --type. Introduced by contributor PR #929. Regression: repeating the flag previously overwrote instead of accumulating, so listing tasks in several statuses silently matched only the last one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 --status can be repeated and matches tasks in any given status
- [x] #2 --status accepts comma-separated values
- [x] #3 a single --status behaves as before and remains case-insensitive
- [x] #4 repeated/inline statuses compose with --exclude-status
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: contributor PR #929 branch checked out locally (worktree). tsc --noEmit passes; new test file 5/5 pass; full suite 2350 pass / 0 fail; TUI suite 109 pass / 0 fail; manual CLI checks for repeated flag, comma-separated, case-insensitive, and exclude-status composition all match PR claims. All 7 CI jobs green on approved run. Biome: only PR-introduced format issue (one line in new test) fixed locally as maintainer edit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged contributor PR #929 which lets task list --status accept repeated and comma-separated status values with OR semantics, matching --exclude-status/--type. Verified with new regression tests, full suite (2350 pass), TUI suite (109 pass), manual CLI checks, and green CI across ubuntu/macos/windows + build + nix.
<!-- SECTION:FINAL_SUMMARY:END -->
