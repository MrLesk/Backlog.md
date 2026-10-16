---
id: BACK-576
title: Multi-assignee parity for task create
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 18:24'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/848'
priority: medium
type: bug
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #848. `backlog task create -a "@a,@b"` stores one literal assignee "@a,@b" because create wraps the raw option value (`[String(options.assignee)]` at src/cli.ts:1821, with the same pattern on the draft path at src/cli.ts:3452), while `task edit` parses the same input through parseDelimitedStringList (src/cli.ts:2999). Repeated `-a` flags silently keep only the last value because the option is declared non-collecting (src/cli.ts:1707, src/cli.ts:2689, src/cli.ts:3440).

The result is that the documented multi-assignee capability works on edit but not on create, and both failure modes are silent. The same defect class was already fixed for --labels in issue #692 / PR #693, so create should reach parity with edit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Comma-separated assignees parse into separate assignees on `task create`
- [x] #2 Comma-separated assignees parse into separate assignees on the draft creation path
- [x] #3 Repeated -a flags collect into multiple assignees on `task create`
- [x] #4 Repeated -a flags collect into multiple assignees on `task edit`
- [x] #5 Tests cover comma-separated and repeated-flag input on both create and edit
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make -a/--assignee repeatable on task create, task edit, and draft create by registering createMultiValueAccumulator (mirroring the #693 label fix shape).
2. Parse create and draft-create assignees through parseDelimitedStringList so comma-separated values split into separate assignees, matching task edit.
3. Document repeatability and comma-separated input in the create/edit help schema and option descriptions.
4. Audit the task-creation wizard and MCP create/edit handlers for the same asymmetry and align them only if a real gap exists.
5. Add CLI tests: comma-separated and repeated -a on task create, repeated -a on task edit, comma-separated and repeated -a on draft create, plus help-schema assertions.
6. Verify with bunx tsc --noEmit, bun run check ., scoped tests, and one full bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Made -a/--assignee repeatable on task create, task edit, and draft create using the existing createMultiValueAccumulator, and routed create/draft-create assignees through parseDelimitedStringList so comma-separated values split into separate assignees. This mirrors the #693 label fix shape: comma-separated parsing plus repeatable flags, with the semantics documented in the create/edit help schema and option descriptions.

Audit result: the task-creation wizard already parsed comma-separated assignees (parseListInput in src/commands/task-wizard.ts, shared by create and edit), and MCP task_create/task_edit already accept assignee as a JSON array on both sides. Neither surface had the create/edit asymmetry, so no changes were needed there.

Simplification: the inline label split duplicated in task create and draft create was replaced with parseDelimitedStringList. Behavior is identical because createTaskFromInput already runs normalizeStringList over labels.

Validation: bunx tsc --noEmit; bun run check .; bun test on cli-guidance, cli-init-create, cli-task-view-edit, draft-create-consistency, cli-plain-create-edit, label-filter, task-wizard, cli-task-wizard (91 pass, 0 fail); full bun run test (1902 pass, 5 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Brought task create and draft create to multi-assignee parity with task edit: -a/--assignee is now repeatable on all three commands and comma-separated values split into separate assignees, matching the shape of the #693 label fix. The wizard and MCP create/edit paths were audited and already handled multi-assignee input, so they were left unchanged. Verified with CLI tests covering comma-separated and repeated -a on create, edit, and draft create plus help-schema assertions, typecheck, Biome, and a full bun run test (1902 pass, 5 skip, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
