---
id: BACK-455
title: Support task milestone assignment in CLI task CRUD
status: To Do
assignee:
  - '@codex'
created_date: '2026-05-01 13:28'
labels:
  - cli
  - milestones
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/618'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #618 requests milestone support on CLI task create/edit so users do not need to edit task files directly or use the HTTP API to assign tasks to milestones. Implement a public CLI path that follows existing task milestone storage semantics and works with current milestone-aware Web/MCP behavior. Context: https://github.com/MrLesk/Backlog.md/issues/618
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog task create` supports setting a task milestone using the existing task milestone field
- [ ] #2 `backlog task edit` supports setting and clearing a task milestone without direct file edits
- [ ] #3 CLI help and validation make the milestone behavior discoverable and safe
- [ ] #4 Focused tests cover create, update, and clear milestone flows
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
