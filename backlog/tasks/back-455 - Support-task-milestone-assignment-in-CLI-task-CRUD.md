---
id: BACK-455
title: Support task milestone assignment in CLI task CRUD
status: Done
assignee:
  - '@codex'
created_date: '2026-05-01 13:28'
updated_date: '2026-05-02 01:01'
labels:
  - cli
  - milestones
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/618'
modified_files:
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/server/index.ts
  - src/test/cli-task-milestone.test.ts
  - src/utils/milestone-storage.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #618 requests milestone support on CLI task create/edit so users do not need to edit task files directly or use the HTTP API to assign tasks to milestones. Implement a public CLI path that follows existing task milestone storage semantics and works with current milestone-aware Web/MCP behavior. Context: https://github.com/MrLesk/Backlog.md/issues/618
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog task create` supports setting a task milestone using the existing task milestone field
- [x] #2 `backlog task edit` supports setting and clearing a task milestone without direct file edits
- [x] #3 CLI help and validation make the milestone behavior discoverable and safe
- [x] #4 Focused tests cover create, update, and clear milestone flows
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add shared milestone storage-input resolver used by CLI plus existing API/MCP paths.
2. Add CLI task create/edit milestone flags, including explicit clearing on edit.
3. Add focused CLI tests for create, edit, title/ID normalization, and clear.
4. Validate with scoped tests, typecheck, and Biome.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added CLI task milestone assignment for `task create` and `task edit`, including title/ID alias normalization shared with API/MCP and explicit clearing through `task edit --clear-milestone`. Added focused CLI coverage for create, edit, clear, conflicting flags, and help output, then validated with scoped tests, full test suite, typecheck, and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
