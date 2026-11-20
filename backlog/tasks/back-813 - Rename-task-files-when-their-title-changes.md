---
id: BACK-813
title: Rename task files when their title changes
status: Done
assignee:
  - '@codex'
created_date: '2026-11-20T20:51:00Z'
updated_date: '2026-11-20T22:53:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1186
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/cli.ts
  - src/mcp/utils/schema-generators.ts
  - src/core/task-identity-index.ts
  - src/core/task-loader.ts
  - src/core/duplicate-task-repair.ts
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/utils/utc-timestamp.ts
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/cli.ts
  - src/mcp/utils/schema-generators.ts
  - src/test/cli-timestamps.test.ts
  - src/test/core-autocommit-scope.test.ts
  - src/test/task-identity-index.test.ts
  - src/utils/utc-timestamp.ts
  - src/test/task-frontmatter-preservation.test.ts
  - src/test/decision-supersession.test.ts
  - src/test/content-frontmatter-preservation.test.ts
  - src/test/duplicate-task-repair.test.ts
  - src/test/cli-task-view-edit.test.ts
  - src/test/reorder-utils.test.ts
  - src/core/task-identity-index.ts
  - src/core/duplicate-task-repair.ts
  - src/core/task-loader.ts
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/core/content-store.ts
  - src/test/content-store.test.ts
  - src/test/cli-create-preserves-existing-files.test.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/test/server-tasks-spa-fallback.test.ts
  - src/git/operations.ts
  - src/test/linked-record-commit.test.ts
  - src/guidelines/cli-instructions/task-execution.md
  - src/test/test-utils.ts
  - src/test/atomic-task-edit.test.ts
  - src/core/archived-task-move.ts
  - src/test/search-service.test.ts
type: bug
ordinal: 413000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task title edit should rename its Markdown file and preserve its ID and links. Across Git branches, copies under different filenames belong to one task when their ID and creation time agree to the second.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Editing a task title renames its file, preserves its ID and creation date, and keeps reads by ID and task links working.
- [x] #2 Across branches, copies with the same ID and different filename titles resolve as one task when their creation times match to the second. Different, missing, invalid, or date-only values stay ambiguous. Two files claiming one ID in the same checkout or branch stay ambiguous.
- [x] #3 Backlog reads creation times for identity only when a task ID appears under different filename titles. Other IDs and ordinary working-copy commands keep their current read behavior.
- [x] #4 New timestamps include actual UTC seconds and Z. Existing timestamps remain readable and a title edit preserves the original creation date.
- [x] #5 CLI help, the CLI reference and agent guidance explain the resulting filename and branch behavior. Automatic Git commits include both paths when a file moves.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the stale filename and the browser and doctor conflict on a tracked title edit. 2. Rename the file only when the title changes, preserve existing creation values, and stage both paths if auto-commit is enabled. Generate new UTC timestamps to the second. 3. Compare creation times only for same-ID claims under different filename titles across branches. Keep same-checkout conflicts and use cached Git content. 4. Update human and agent guidance, run regression and full checks, and review the result.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before the fix, moving a tracked task to its new title on one branch made the browser return HTTP 409 and doctor report a duplicate. A regression test also showed the board displayed both titles. The revised identity and doctor tests failed first, then passed.

The browser now reopens the renamed task by ID while another branch keeps the old filename. A warm-cache regression measured zero extra Git content reads when the names matched. After a working filename changed, only distinct blobs for that ID were read, once each. Different or incomplete creation times, and multiple files claiming one ID in one branch, stay ambiguous.

A temporary Git project verified the CLI rename, preserved creation second and dependency ID, and clean doctor results on both branches. The CLI help and live MCP task_edit schema describe the move. The identity, loader, content-store, doctor, dependency and browser suites passed 224 tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A title edit renames the task’s Markdown file and keeps its ID, original creation time and dependencies. Automatic commits include both filenames. The browser and doctor compare UTC creation seconds only when an ID appears under different filename titles across branches. They still flag separate files in one branch or checkout. New timestamps keep the actual UTC second.

Verified with the compiled CLI on two branches, an open board watching an external edit, and a read-only task. The full local CI test profile passed 3,817 tests with 13 skipped. Type checking, Biome and the compiled CLI smoke checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
