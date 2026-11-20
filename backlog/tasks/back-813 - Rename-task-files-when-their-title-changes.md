---
id: BACK-813
title: Rename task files when their title changes
status: Done
assignee:
  - '@codex'
created_date: '2026-11-20T20:51:00Z'
updated_date: '2026-11-20T23:18:43Z'
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
  - ADVANCED-CONFIG.md
  - src/board.ts
  - src/markdown/serializer.ts
  - src/utils/task-updated-date.ts
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
  - src/test/board.test.ts
  - src/board.ts
  - src/readme.ts
  - ADVANCED-CONFIG.md
  - src/test/task-updated-date.test.ts
  - src/utils/task-updated-date.ts
  - src/markdown/frontmatter.ts
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
- [x] #6 On the next edit, a valid historical creation timestamp with a time is saved as UTC to the second for tasks, drafts, documents and decisions. Calendar dates keep their original meaning, and reads alone never rewrite a file.
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

Verify creation and update timestamps on tasks, drafts, documents and decisions, and use the same UTC-second formatter for timestamps written to board exports. Correct the documented storage precision.

Apply the approved legacy timestamp rule at write time, including edits made through the external task or draft editor. Verify UTC offsets, missing seconds, calendar dates, and unchanged files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before the fix, moving a tracked task to its new title on one branch made the browser return HTTP 409 and doctor report a duplicate. A regression test also showed the board displayed both titles. The revised identity and doctor tests failed first, then passed.

The browser now reopens the renamed task by ID while another branch keeps the old filename. A warm-cache regression measured zero extra Git content reads when the names matched. After a working filename changed, only distinct blobs for that ID were read, once each. Different or incomplete creation times, and multiple files claiming one ID in one branch, stay ambiguous.

A temporary Git project verified the CLI rename, preserved creation second and dependency ID, and clean doctor results on both branches. The CLI help and live MCP task_edit schema describe the move. The identity, loader, content-store, doctor, dependency and browser suites passed 224 tests.

The compiled CLI created and edited all four record types in Pacific/Auckland. Reading a legacy file left its bytes intact. Editing an offset time converted it to the same UTC second on the previous day. An ordinal-only edit kept the original update time. The terminal editor preserved unrelated YAML comments, aliases and line endings, and its five interactive checks passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A title edit renames the task’s Markdown file and keeps its ID, creation time and links. Automatic Git commits include both paths. Across branches, when one ID has different filename titles, the browser and doctor compare creation times to the second. Two files claiming an ID in the same branch still count as a conflict.

Tasks, drafts, documents and decisions save creation and update times in UTC to the second. A real edit converts an older timestamp to the same UTC instant. A calendar date stays a calendar date. Terminal editor saves preserve unrelated Markdown and YAML, and board exports use the same UTC format.

The compiled CLI verified all four record types in Pacific/Auckland. The full test profile passed 3,826 tests with 13 skipped. All five compiled terminal editor tests, the compiled CLI smoke checks, TypeScript and Biome passed.
<!-- SECTION:FINAL_SUMMARY:END -->
