---
id: BACK-638
title: Allow task list --status to accept several statuses
status: Done
assignee:
  - '@MrLesk'
created_date: '2026-08-22 12:22'
updated_date: '2026-08-23 12:27'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add shared src/utils/status-filter.ts (normalizeStatusSet + statusMatchesSet) for multi-status normalization/case-insensitive matching. 2. Use it in Core.applyTaskFilters, ContentStore.getTasks, FileSystem.listTasks (include + exclude blocks). 3. Carry structured multi-status through the interactive path: UnifiedViewFilters.statusFilter becomes string[], TUI status popup becomes multi-select like type/labels, filter-header shows joined selection, task-search matches any selected status. 4. CLI: search --status becomes repeatable like task list --status; filter description renders lists; initialUnifiedFilter receives parsed selection. 5. Tests: helper unit tests, unified-view filter-state arrays, plain-path regressions incl. JSON and search. Finding 3 (comma-containing status names) declined by maintainer decision - parsing untouched.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: contributor PR #929 branch checked out locally (worktree). tsc --noEmit passes; new test file 5/5 pass; full suite 2350 pass / 0 fail; TUI suite 109 pass / 0 fail; manual CLI checks for repeated flag, comma-separated, case-insensitive, and exclude-status composition all match PR claims. All 7 CI jobs green on approved run. Biome: only PR-introduced format issue (one line in new test) fixed locally as maintainer edit.

Review round (PR #929 takeover): fixed Codex findings 1/2/4. Finding 1+4: interactive paths now receive the structured multi-status selection - UnifiedViewFilters.statusFilter became string[], the TUI status popup is multi-select like type/labels, task-search matches any selected status via the shared helper, and search --status is repeatable like task list --status so repeated flags accumulate instead of last-wins. Finding 2: one shared helper src/utils/status-filter.ts (normalizeStatusSet + statusMatchesSet) now backs Core.applyTaskFilters, ContentStore.getTasks, FileSystem.listTasks, and utils/task-search include/exclude blocks with identical trim/lowercase/blank-drop semantics. Finding 3 (status names containing commas) declined by maintainer decision; comma-splitting untouched. Verified: tsc clean; biome clean on changed files; cli-status-filtering 9/9, status-filter 6/6 + unified-view-filters 17/17, full suite 2357 pass / 0 fail; tui-test manual check of task list and search with repeated and comma forms shows only matching tasks ('Status: 2 selected') with no crash.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged contributor PR #929 which lets task list --status accept repeated and comma-separated status values with OR semantics, matching --exclude-status/--type. Verified with new regression tests, full suite (2350 pass), TUI suite (109 pass), manual CLI checks, and green CI across ubuntu/macos/windows + build + nix.
<!-- SECTION:FINAL_SUMMARY:END -->
