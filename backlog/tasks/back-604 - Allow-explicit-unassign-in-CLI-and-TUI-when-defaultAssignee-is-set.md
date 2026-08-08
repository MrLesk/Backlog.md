---
id: BACK-604
title: Allow explicit unassign in CLI and TUI when defaultAssignee is set
status: To Do
assignee: []
created_date: '2026-08-08 15:56'
labels: []
dependencies: []
ordinal: 243000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With defaultAssignee configured, the CLI has no way to create or edit a task so it ends up unassigned; web and MCP can via an explicit empty list. Approved direction from Alex (2026-08-08): support an explicit empty assignee value (for example --assignee "") that clears the assignee and overrides defaultAssignee, keeping semantics consistent with the web/MCP empty-list behavior. The TUI must also offer a way to clear the assignee. If this mechanism turns out not to be viable, surface the alternative for a decision instead of choosing one silently.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task create --assignee "" produces an unassigned task even when defaultAssignee is set
- [ ] #2 task edit --assignee "" clears the existing assignee
- [ ] #3 The TUI can clear the assignee of a task
- [ ] #4 Behavior is consistent with the web and MCP explicit empty-list semantics
- [ ] #5 Tests cover create and edit with defaultAssignee set
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
