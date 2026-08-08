---
id: BACK-604
title: Allow explicit unassign in CLI and TUI when defaultAssignee is set
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 21:52'
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
- [x] #1 task create --assignee "" produces an unassigned task even when defaultAssignee is set
- [x] #2 task edit --assignee "" clears the existing assignee
- [x] #3 The TUI can clear the assignee of a task
- [x] #4 Behavior is consistent with the web and MCP explicit empty-list semantics
- [x] #5 Tests cover create and edit with defaultAssignee set
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
One rule now governs assignees on every surface: an absent assignee means "no opinion" (the configured defaultAssignee applies on create, the existing value is kept on edit), and an explicit empty assignee means "unassigned". The distinction is created once at the CLI boundary and carried through unchanged.

Verified web/MCP semantics BEFORE this change (the task description's premise was only partly true):
- core editTaskOrDraft already honored an explicit empty assignee array as "clear", but only the Web edit payload could reach it (server handleUpdateTask passes assignee straight through when the key is present).
- MCP task_edit could NOT clear: buildTaskUpdateInput ran the assignee through normalizeStringList, which collapses [] to undefined and drops the field.
- createTaskFromInput applied defaultAssignee whenever the normalized list was empty, so an explicit empty list was indistinguishable from an absent one on every create surface: CLI -a "", draft create -a "", MCP assignee: [], and the Web create payload all received the default.
So Web edit was the only surface where an explicit empty list actually meant "unassigned".

Changes:
- src/core/backlog.ts createTaskFromInput now keys the default off input.assignee === undefined instead of "the normalized list is empty". This is the single shared create path for CLI, draft create, the creation wizard, the TUI composer, Web POST and MCP task_create, so one edit gives every surface the same meaning.
- src/utils/task-builders.ts adds parseClearableStringList: undefined when the Commander option is absent, [] when it is present with only blank values. It reuses parseDelimitedStringList rather than duplicating parsing.
- src/cli.ts uses it for task create, draft create and task edit; task edit now assigns editArgs.assignee even when the parsed list is empty. -a someone is unchanged everywhere.
- src/utils/task-edit-builder.ts resolves the assignee through the existing sanitizeClearableStringArray helper already used for dependencies, references and documentation, which fixes MCP task_edit in the same place as the CLI instead of adding a second code path.
- src/web/components/TaskDetailsModal.tsx omits assignee from the create payload when the chip input is blank. The modal always sent assignee: [], so honoring the explicit empty at core would otherwise have silently disabled defaultAssignee for every Web-created task. A blank field on create now means "no opinion", exactly like an omitted -a; Web edit still sends [] and clears. Consequence: the Web create form cannot express "explicitly unassigned" while a default is configured; clear it right after creating, or use the CLI or MCP.
- Documented the convention in task create/edit/draft create help, the create help schema, the MCP task_create and task_edit schema descriptions, ADVANCED-CONFIG.md and the shipped task-creation instructions.

No new flags were added: the empty value works through Commander, so there is no --clear-assignee.

TUI (acceptance criterion 3, left unchecked): the TUI has no assignee editing surface to extend. The TUI create composer (src/ui/components/task-composer.ts) exposes only title, description, status, type and priority. The TUI edit action (src/ui/board.ts and src/ui/task-viewer-with-search.ts calling core.editTaskInTui) shells out to $EDITOR on the task markdown, so hand-editing frontmatter is the only TUI route to an assignee today. Every other assignee reference under src/ui/ is display or filter-only. The interactive assignee prompts that do exist are the clack CLI wizards in src/commands/task-wizard.ts (backlog task create and task edit with no flags in a TTY); the edit wizard pre-fills the current assignees and already clears them when the field is blanked. Adding a TUI assignee field would be a new UI surface, which this task was told not to build, so it needs a product decision.

Open question for review: #878 (BACK-603) made a blank value an ERROR for --dep, --ref and --doc on create, with --clear-deps/--clear-refs/--clear-docs as the clearing mechanism on edit. -a "" now means "clear" instead of being an error, so the two list-flag conventions differ. That is the mechanism approved for this task and assignee has no clear flag, but it may be worth aligning later.

Validation: bunx tsc --noEmit clean; bun run check . clean (369 files). Full bun run test: 2093 tests, 2079 pass, 6 skip, 8 fail. All 8 failures are filesystem-watcher timing tests unrelated to assignee handling, and the machine was running several concurrent test suites: the 7 ContentStore failures reproduce identically on origin/main (46 pass / 7 fail on both branches), and src/test/server-search-endpoint.test.ts passes on its own (25 pass / 0 fail). src/test/tui-task-composer.test.ts also failed its watcher-delivery test in an earlier run and reproduced identically on origin/main; it passed in the final run.

Scoped suites green on this branch: core.test.ts, cli-init-create.test.ts, cli-task-view-edit.test.ts, draft-create-consistency.test.ts, mcp-tasks.test.ts, web-task-types.test.tsx, cli-guidance.test.ts, task-wizard.test.ts, cli-task-wizard.test.ts, cleanup.test.ts.

Manual CLI check in a scratch project with defaultAssignee set to @alice,@bob: task create without -a gave [@alice, @bob]; task create -a "" gave []; task create -a @carol gave [@carol]; draft create -a "" gave []; task edit -a "" cleared @carol; a title-only task edit left [@alice, @bob] untouched.

Owner ruling (Alex, 2026-08-08): the TUI task composer intentionally has no assignee field, so there is no TUI surface to clear; interactive clearing is covered by the CLI edit wizard (blanked field clears). AC 3 checked by maintainer direction with this rationale.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @Claude
created: 2026-08-08 19:11
---
AC #3 (TUI can clear the assignee) is deliberately left unchecked: the TUI has no assignee editing surface at all today, so satisfying it would mean building a new TUI field rather than adjusting existing behaviour. Details and the exact code paths are in the implementation notes. Also flagged there: -a "" now means clear, while BACK-603/#878 made a blank value an error for --dep/--ref/--doc with dedicated --clear-* flags, so the two list-flag conventions differ.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An explicit empty assignee now means "unassigned" on every surface, while an absent assignee still means "no opinion". core createTaskFromInput keys defaultAssignee off input.assignee === undefined instead of "the normalized list is empty", a new parseClearableStringList preserves the absent-vs-explicit-empty distinction coming out of Commander for task create, draft create and task edit, and buildTaskUpdateInput routes the assignee through the existing sanitizeClearableStringArray helper so MCP task_edit can clear it too. The Web create payload omits a blank assignee so defaultAssignee keeps applying there; Web edit still sends an empty list and clears. Verified with new tests in core, CLI create/edit, draft create, MCP and web-payload suites, plus a manual CLI run covering create-with-default, create -a "", create -a @name, draft create -a "", edit -a "" and a title-only edit. AC #3 is unchecked because the TUI has no assignee editing surface to extend; that needs a product decision.
<!-- SECTION:FINAL_SUMMARY:END -->
