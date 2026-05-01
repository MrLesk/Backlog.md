---
id: BACK-454
title: Default ordinals for created tasks
status: To Do
assignee:
  - '@codex'
created_date: '2026-05-01 13:28'
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
- [ ] #1 New tasks created without an explicit ordinal receive a tail ordinal based on existing tasks
- [ ] #2 Explicit ordinal values remain preserved through CLI/core/MCP create paths
- [ ] #3 PR #617 title follows the BACK task title format and includes this task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
