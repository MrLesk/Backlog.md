---
id: BACK-604
title: Allow explicit unassign in CLI and TUI when defaultAssignee is set
status: In Progress
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 17:23'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add parseClearableStringList to src/utils/task-builders.ts: absent option -> undefined, present-but-blank -> [], otherwise the normalized list. This is the single place that preserves the absent-vs-explicit-empty distinction from Commander.
2. src/core/backlog.ts createTaskFromInput: apply config.defaultAssignee only when input.assignee === undefined instead of when the normalized list is empty, so an explicit empty list means 'unassigned' and absent still means 'no opinion'.
3. src/utils/task-edit-builder.ts: resolve assignee with the existing sanitizeClearableStringArray helper (same pattern already used for dependencies/references/documentation) so an explicit empty list clears the field. This fixes CLI task edit and MCP task_edit in one place.
4. src/cli.ts: use parseClearableStringList for task create, draft create and task edit assignee parsing, and set editArgs.assignee even when the parsed list is empty. Update the -a help text and the create help schema description to document the empty-value convention.
5. Docs: ADVANCED-CONFIG.md and src/guidelines/cli-instructions/task-creation.md describe -a "" as the explicit unassign escape hatch.
6. Tests: core create with defaultAssignee set (explicit empty -> unassigned, absent -> default applied), CLI task create/draft create with -a "", CLI task edit -a "" clears and flag-absent keeps, task-edit-builder unit coverage.
7. TUI: verified there is no assignee editing surface at all (the create composer only has title/description/status/type/priority; TUI edit opens $EDITOR on the markdown file). Per instruction, report this instead of building a new TUI field.
8. Verify: bunx tsc --noEmit, bun run check ., full bun run test.
<!-- SECTION:PLAN:END -->
