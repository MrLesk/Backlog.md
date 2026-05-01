---
id: BACK-454
title: Default ordinals for created tasks
status: Done
assignee:
  - '@codex'
created_date: '2026-05-01 13:28'
updated_date: '2026-05-01 13:33'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/617'
modified_files:
  - src/cli.ts
  - src/core/backlog.ts
  - src/test/cli-plain-create-edit.test.ts
  - src/test/core.test.ts
  - src/test/mcp-tasks.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PR #617 adds default ordinal assignment for newly created tasks and preserves explicit ordinal input through the shared create path. The PR should have a Backlog task and repository-standard title before review/merge. Context: https://github.com/MrLesk/Backlog.md/pull/617
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New tasks created without an explicit ordinal receive a tail ordinal based on existing tasks
- [x] #2 Explicit ordinal values remain preserved through CLI/core/MCP create paths
- [x] #3 PR #617 title follows the BACK task title format and includes this task
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Linked PR #617 to BACK-454, tightened ordinal validation to reject non-finite values, and verified CLI/core/MCP ordinal coverage plus typecheck and lint.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
