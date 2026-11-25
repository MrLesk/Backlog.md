---
id: BACK-801
title: Reject unknown statuses in task list --status
status: Done
assignee:
  - '@SAY-5'
created_date: '2026-11-13T18:33:00Z'
updated_date: '2026-11-13T18:33:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1181
  - src/cli.ts
  - src/test/cli-status-filtering.test.ts
modified_files:
  - src/cli.ts
  - src/test/cli-status-filtering.test.ts
type: bug
ordinal: 407000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1181: `backlog task list --status Bogus` exits 0 with an empty list, so a typo in a status reads the same as a status with no tasks. `--exclude-status`, `--type`, `--project` and `--priority` already reject values that are not configured, but `--status` passed the raw value straight to the filter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task list --status with a value that is not a configured status exits 1 and names the invalid value and the valid statuses, as --exclude-status does.
- [x] #2 Configured statuses still filter case-insensitively, repeated or comma-separated.
- [x] #3 A real CLI regression fails against the previous behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a CLI regression for an unknown --status value and confirm it fails before the fix.
2. Route task list --status through normalizeCliStatusList, the helper --exclude-status already uses.
3. Run the status filtering tests, type checking and Biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The new regression in src/test/cli-status-filtering.test.ts failed before the fix (exit 0) and passes after it. Status filtering, exclude-status, list window, JSON output and task list suites pass. A task whose status was removed from the config can no longer be selected with --status, which matches how --exclude-status already treats such a value.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
task list --status now goes through normalizeCliStatusList, like --exclude-status, so an unknown status exits 1 with "Invalid status: <value>. Valid statuses are: ..." instead of an empty list. Configured statuses still match case-insensitively and can be repeated or comma-separated. bun run check:types and Biome pass.
<!-- SECTION:FINAL_SUMMARY:END -->
