---
id: BACK-586
title: Clear references and documentation through the CLI
status: To Do
assignee: []
created_date: '2026-08-07 19:41'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/861'
priority: medium
type: bug
ordinal: 227000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix GitHub issue #861: `task edit --ref ""` and `task edit --doc ""` exit 0 and print "Updated task TASK-1" while leaving references and documentation unchanged, and neither list has a supported clear operation. Reported against 1.49.3: after `task create "List probe" --ref a --ref b --doc doc-a --doc doc-b`, both `task edit task-1 --ref ""` and `task edit task-1 --doc ""` report success while `--json` still shows the original values, and `--clear-refs`/`--clear-docs` are unknown options. This is the same false-success defect class as issue #839, which was resolved by PR #840 (BACK-572) with `--clear-deps`: reject empty setter values with an error naming the clear flag, reject combining the clear flag with a setter for the same field, and let an explicit empty list clear. Mirror that shape for references and documentation. Issue #856 (incremental --add-ref/--remove-ref) is out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task edit --clear-refs removes all references and --clear-docs removes all documentation from an existing task
- [ ] #2 Empty --ref or --doc values are rejected with a non-zero exit and an error naming --clear-refs or --clear-docs, and the task is left unchanged
- [ ] #3 --clear-refs cannot be combined with --ref and --clear-docs cannot be combined with --doc; invalid input does not mutate the task
- [ ] #4 The interactive-TTY edit wizard predicate includes the new flags so --clear-refs/--clear-docs apply directly instead of opening the wizard
- [ ] #5 MCP task_edit treats blank-only references/documentation arrays as a no-op while an explicit empty array clears the list, matching the labels convention
- [ ] #6 CLI help documents --clear-refs and --clear-docs, and regression tests cover clearing, empty-value rejection, conflict rejection, the interactive-TTY path, and the MCP blank-only vs explicit-empty behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
