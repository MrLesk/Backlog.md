---
id: BACK-597
title: Add incremental reference flags to task edit
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 21:36'
updated_date: '2026-08-07 22:08'
labels:
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/856'
priority: medium
type: enhancement
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix GitHub issue #856: `backlog task edit --ref` replaces the entire references array and the CLI has no way to add or remove a single reference while preserving the others. Reported against 1.49.3: after `task create "Reference probe" --ref seed:a --ref seed:b`, running `task edit task-1 --ref added:c` leaves references as `[added:c]`, and `task edit --help` documents no add/remove reference flags.

Surface drift: the manifesto makes the CLI canonical and names surface consistency as a design principle, but the optional MCP adapter already exposes safer incremental mutations that CLI users cannot perform. The public MCP `task_edit` schema exposes `addReferences` and `removeReferences`, and the shared task-update model implements them (additions preserve existing references and do not duplicate, removals match reference values and leave unrelated entries unchanged). Expose those same shipped model operations through `task edit` as `--add-ref` and `--remove-ref` rather than reimplementing merge semantics; `--ref` stays the explicit replace-all operation.

Why it matters beyond convenience: adding one reference today requires an external read, merge, and full-array replacement. A concurrent writer between the read and the edit is silently discarded. This is a different boundary of the lost-update hazard than the task-edit locking work in issue #843, which cannot make a client-side read part of the same critical section.

Conventions to follow: repeated and comma-separated values via the existing multi-value flag convention, and the clearable-list rules established by BACK-586 (issue #861) - the new flags must join the interactive-wizard predicate, reject blank occurrences with an error naming the clear flag, and be mutually exclusive with `--clear-refs`. BACK-586 implementation notes explicitly anticipated this follow-up.

Scope: references only. Documentation has the identical drift (MCP exposes addDocumentation/removeDocumentation with no CLI equivalent); record it as a follow-up observation, do not implement it here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task edit --add-ref adds references while preserving existing references and does not create duplicates
- [x] #2 task edit --remove-ref removes references by value and leaves unrelated references unchanged
- [x] #3 Both flags accept repeated occurrences and comma-separated values like other multi-value task edit flags
- [x] #4 Blank --add-ref or --remove-ref values are rejected with a non-zero exit and the task is left unchanged
- [x] #5 --clear-refs cannot be combined with --add-ref or --remove-ref, and invalid input does not mutate the task
- [x] #6 The interactive-TTY edit wizard predicate includes the new flags so they apply directly instead of opening the wizard
- [x] #7 --ref still replaces the full reference list and CLI help documents --add-ref and --remove-ref
- [x] #8 Regression tests cover add and remove semantics, repeated and comma forms, blank rejection, the clear conflict, the interactive-TTY path, and unchanged MCP task_edit reference behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add --add-ref and --remove-ref to task edit: Commander options using createMultiValueAccumulator, parsed with parseDelimitedStringList so repeated and comma forms both work.
2. Route through the shipped model ops: set editArgs.addReferences/removeReferences so buildTaskUpdateInput maps them to the same TaskUpdateInput fields MCP task_edit uses; no new merge logic.
3. Join the BACK-586 conventions: add both flags to hasEditFieldFlags, and reuse validateClearableListInput per flag so blank occurrences are rejected and --clear-refs conflicts are caught, keeping the existing --ref error strings byte-identical.
4. Reject --ref combined with --add-ref/--remove-ref, mirroring the --label vs --add-label/--remove-label rule, so replacement and incremental operations stay mutually exclusive across list fields.
5. Add addHelpSchema entries for add-ref and remove-ref following the labels wording convention.
6. Extend src/test/cli-refs-docs.test.ts: add preserves and dedups, remove matches values and leaves others, repeated and comma forms, blank rejection, clear conflict, --ref conflict, interactive-TTY path, and pin add+remove of the same value in one command to the shipped model order (add runs first, removal wins).
7. Verify: bunx tsc --noEmit, bun run check ., cli-refs-docs / cli-dependency / mcp-refs-docs / references test files, then the full suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added task edit --add-ref and --remove-ref, routed through the shipped model operations MCP task_edit already uses: the CLI sets editArgs.addReferences/removeReferences, buildTaskUpdateInput maps them to TaskUpdateInput.addReferences/removeReferences, and Core.updateTask.resolveReferences applies them. No merge semantics were reimplemented.

Conventions reused rather than duplicated:
- Commander options use createMultiValueAccumulator and are parsed with parseDelimitedStringList, so repeated flags and comma-separated values both work (same shape as -a/--assignee and --label). --ref was switched to createMultiValueAccumulator too, replacing its inline copy of the same closure.
- Both flags joined hasEditFieldFlags, so an interactive TTY applies them directly instead of opening the edit wizard.
- Blank occurrences and --clear-refs conflicts reuse the shared validateClearableListInput helper introduced by BACK-586, called once per flag so the errors name the exact flag ("Cannot use an empty value with --add-ref. Use --clear-refs to remove all references."). The existing --ref/--doc/--clear-deps error strings are untouched.

One decision beyond the issue text: --ref combined with --add-ref/--remove-ref is rejected, mirroring the existing --label vs --add-label/--remove-label rule, so replacement and incremental operations stay mutually exclusive across list fields (manifesto surface consistency). Without it the command would silently mean "replace, then add".

Add + remove of the same value in one command: the shared model applies additions first and removals second, so the removal wins and the value ends up absent. That is pinned by a test rather than changed, so CLI and MCP agree.

Public instruction surface: src/guidelines/agent-guidelines.md now lists Replace/Add/Remove references rows instead of a single "Add references" row that used the replace-all flag.

Follow-up observation (scope guard, not implemented): documentation has the identical drift. MCP task_edit exposes addDocumentation/removeDocumentation and Core.updateTask implements them, but the CLI still has only --doc (replace) and --clear-docs. A follow-up would add --add-doc/--remove-doc through the same helpers.

Validation: bunx tsc --noEmit clean; bun run check . clean (358 files); bun test src/test/cli-refs-docs.test.ts 31 pass; bun test src/test/mcp-refs-docs.test.ts src/test/cli-dependency.test.ts src/test/references.test.ts src/test/documentation.test.ts src/test/mcp-tasks.test.ts 62 pass (MCP reference behavior unchanged); bun test src/test/agent-instructions.test.ts green; full bun run test 1953 pass / 5 skip / 0 fail across 214 files (one unrelated flake appeared in an earlier full run and did not reproduce in two subsequent full runs). Live reproduction of issue #856 in a scratch project: seed:a,seed:b then --add-ref added:c preserves both seeds; --add-ref "seed:a,added:d" dedups seed:a; --remove-ref seed:a leaves the rest; blank, --clear-refs, and --ref conflicts exit 1 without mutating the task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Exposed the existing incremental reference mutations through the canonical CLI as task edit --add-ref and --remove-ref, closing the surface drift reported in issue #856 where only MCP task_edit could add or remove a single reference. Both flags are repeatable and comma-parsed, route through the same shared model operations MCP uses (addReferences/removeReferences) instead of new merge logic, join the BACK-586 conventions (interactive-TTY predicate, per-flag blank rejection, mutual exclusion with --clear-refs), and are rejected alongside --ref so replacement and incremental edits stay exclusive like labels. --ref remains the replace-all operation. Verified with 9 new CLI regression tests, unchanged MCP reference tests, updated agent guidelines, a live reproduction of the issue, bunx tsc --noEmit, bun run check ., and the full suite (1953 pass, 5 skip, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
