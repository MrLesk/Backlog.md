---
id: BACK-743.1
title: Return a failing exit code when doc view cannot find a document
status: Done
assignee:
  - '@codex'
created_date: '2026-10-25T19:12:00Z'
updated_date: '2026-10-25T19:16:00Z'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1148'
  - src/cli.ts
  - src/test/cli-doc-view.test.ts
modified_files:
  - src/test/cli-doc-view.test.ts
  - src/cli.ts
parent_task_id: BACK-743
priority: medium
type: bug
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1148 shows that scripts treat a missing document as present because doc view prints a not-found message but returns success. This subtask delivers the missing-document part of BACK-743 as a focused fix; duplicate document and decision list diagnostics remain in the parent task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Viewing a missing document exits 1, leaves stdout empty, and prints the not-found message to stderr, both with and without --plain.
- [x] #2 Viewing an existing document still exits 0 and returns its content.
- [x] #3 Regression coverage exercises the real CLI and fails against the previous missing-document behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a real CLI regression for a missing document with and without --plain, and confirm it fails before the fix.
2. Set exit code 1 on the existing doc view failure paths without changing output or successful reads.
3. Run document view and lifecycle regression suites, type checking, Biome, and the build. Review the final diff for unnecessary changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before the fix, the real CLI regression failed in both output modes: expected exit 1 but received 0. Both existing successful document reads passed.

The existing doc view failure paths now set exit code 1. Not-found text and empty stdout are unchanged, and successful reads still exit 0. The simplification review kept the change in the existing handler without adding helpers or APIs.

Verification: the two new real CLI cases failed before the fix and pass after it. The focused document-view, restore/delete and identity run passed 45 tests; the full doctor suite passed 35 tests with the Git-lock access its fixtures require; the archive suite passed 36 tests with its known interactive case excluded. These runs cover 114 distinct tests. Type checking, Biome, the build and git diff --check passed. Biome reported an existing informational schema/CLI version mismatch (2.6.2 versus installed 2.5.15).

The archive interactive-viewer test still fails because its captured text loses spaces. The same assertion and output reproduced using an unchanged HEAD (6f988de0) exported to a temporary directory. It is unrelated to the exit-code change. The first sandboxed doctor run failed because its shared .git lock directory was not writable; the permitted rerun passed all 35 tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed #1148: doc view now exits 1 when a document cannot be found or read, with the existing stderr message and empty stdout. Existing document reads continue to succeed. Added real CLI regressions for both output modes and confirmed they fail before the fix. Across focused runs, 114 distinct regression tests passed; types, Biome and build passed. One terminal-rendering assertion also fails on unchanged main and remains outside this fix.
<!-- SECTION:FINAL_SUMMARY:END -->
