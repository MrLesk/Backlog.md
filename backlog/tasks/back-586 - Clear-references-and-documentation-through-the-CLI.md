---
id: BACK-586
title: Clear references and documentation through the CLI
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 19:41'
updated_date: '2026-08-07 19:52'
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
- [x] #1 task edit --clear-refs removes all references and --clear-docs removes all documentation from an existing task
- [x] #2 Empty --ref or --doc values are rejected with a non-zero exit and an error naming --clear-refs or --clear-docs, and the task is left unchanged
- [x] #3 --clear-refs cannot be combined with --ref and --clear-docs cannot be combined with --doc; invalid input does not mutate the task
- [x] #4 The interactive-TTY edit wizard predicate includes the new flags so --clear-refs/--clear-docs apply directly instead of opening the wizard
- [x] #5 MCP task_edit treats blank-only references/documentation arrays as a no-op while an explicit empty array clears the list, matching the labels convention
- [x] #6 CLI help documents --clear-refs and --clear-docs, and regression tests cover clearing, empty-value rejection, conflict rejection, the interactive-TTY path, and the MCP blank-only vs explicit-empty behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add --clear-refs and --clear-docs to task edit: Commander options, the addHelpSchema option list, and the hasEditFieldFlags interactive-wizard predicate.
2. Consolidate the clearable-list validation used by --clear-deps into one shared cli.ts helper and reuse it for references and documentation, keeping the existing dependency error text byte-identical.
3. Reject empty --ref/--doc occurrences and clear/setter conflicts before the edit runs, so no false-success output can occur.
4. Make buildTaskUpdateInput treat references and documentation like dependencies: blank-only arrays are a no-op, an explicit empty array clears (shared resolveClearableList helper).
5. Add CLI regression coverage (clear, empty rejection, conflict rejection, interactive-TTY path, help output) and MCP coverage for blank-only vs explicit empty arrays.
6. Run bunx tsc --noEmit, bun run check ., the focused test files, and the full bun test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added task edit --clear-refs and --clear-docs mirroring the --clear-deps shape from PR #840 (BACK-572): Commander options, addHelpSchema entries, hasEditFieldFlags membership so an interactive TTY applies the flags instead of opening the wizard, conflict rejection against the same-field setter, and rejection of empty --ref/--doc occurrences with an error naming the clear flag.

Simplification instead of literal duplication: the dependency validation block was consolidated into one cli.ts helper (validateClearableListInput) now shared by dependencies, references, and documentation. The existing --clear-deps error strings are byte-identical, so BACK-572 regression tests stay green. Likewise buildTaskUpdateInput now uses one sanitizeClearableStringArray helper for dependencies, references, and documentation, which gives references and documentation the labels convention: a blank-only array is a no-op, an explicit empty array clears.

No core change was needed: Core.updateTask already treats an explicit empty references/documentation list as a clear.

Interaction note for issue #856 (out of scope here): when incremental --add-ref/--remove-ref land, they must be added to the same validateClearableListInput conflict check so --clear-refs/--clear-docs stay mutually exclusive with them, and to hasEditFieldFlags.

Validation: bunx tsc --noEmit clean; bun run check . clean (357 files); bun test src/test/cli-refs-docs.test.ts (23 pass); bun test src/test/mcp-refs-docs.test.ts src/test/cli-dependency.test.ts (11 pass); bun test src/test/mcp-tasks.test.ts src/test/references.test.ts src/test/documentation.test.ts (51 pass); full bun run test 1910 pass / 5 skip / 0 fail across 213 files. Live repro of issue #861 in a scratch project confirmed: empty --ref/--doc now exit 1 with the clear-flag error and leave the task JSON unchanged, --clear-refs then --clear-docs move references and documentation to [].
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added task edit --clear-refs and --clear-docs and stopped empty --ref/--doc values from reporting a false success, mirroring the --clear-deps fix from PR #840. Empty setter values and clear/setter conflicts now exit 1 with an error naming the clear flag, the interactive-TTY predicate recognizes both flags, and MCP task_edit treats blank-only reference/documentation arrays as a no-op while an explicit empty array clears. Verified with new CLI and MCP regression tests, a live reproduction of issue #861, bunx tsc --noEmit, bun run check ., and the full suite (1910 pass, 5 skip).
<!-- SECTION:FINAL_SUMMARY:END -->
