---
id: BACK-83
title: Add case-insensitive status filter support
status: Done
assignee:
  - '@claude'
created_date: '2025-06-18'
updated_date: '2025-06-19'
labels:
  - enhancement
  - cli
dependencies: []
---

## Description

Allow status filtering to be case-insensitive when using --status/-s flag.

## Acceptance Criteria

- [x] Status filtering works case-insensitively (e.g., "done", "Done", "DONE" all match "Done" status)
- [x] Case-insensitive filtering works for both --status and -s flags
- [x] Existing functionality maintains backward compatibility
- [x] Update help text to reflect case-insensitive behavior
- [x] Add tests for case-insensitive filtering with both flags

## Implementation Notes

- Modified `src/cli.ts` to convert both the input status and task status to lowercase before comparison (line 282-283)
- Updated help text for the `--status` flag to indicate case-insensitive behavior
- Added comprehensive test coverage in `src/test/cli.test.ts` including tests for lowercase, uppercase, mixed case, and the -s shorthand flag
- The change is backward compatible as it makes the filtering more permissive rather than restrictive
