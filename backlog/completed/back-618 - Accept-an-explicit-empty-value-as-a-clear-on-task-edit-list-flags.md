---
id: BACK-618
title: Accept an explicit empty value as a clear on task edit list flags
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 16:05'
updated_date: '2026-08-09 16:26'
labels: []
dependencies: []
ordinal: 257000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner decision (Alex, 2026-08-09): accept --dep "" as a second clear spelling on task edit, alongside the existing --clear-deps. Rationale: BACK-604 made -a "" mean "clear" for assignees while BACK-603 made empty values an error for the other list flags, leaving two conventions. Direction: on task edit, an explicit empty value for the clearable list families (--dep/--depends-on, --ref, --doc) now clears that list, exactly like the corresponding --clear-* flag; the --clear-* flags remain. On CREATE the empty value stays an error (nothing to clear and no default to override, unlike assignee). Update the edit-path error message that currently rejects empty values to implement the clear instead; keep the create-path message from BACK-603 unchanged. The shared validateTaskListFlags/validateClearableListInput helpers in src/cli.ts are where the behavior lives.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task edit --dep "" clears dependencies, equivalent to --clear-deps
- [x] #2 task edit --ref "" and --doc "" clear their lists the same way
- [x] #3 task create with an empty value for these flags still errors with the BACK-603 message
- [x] #4 Combining an empty value with the corresponding --clear-* flag is not an error (same meaning), and --clear-* flags keep working alone
- [x] #5 Tests cover clear-via-empty on edit for all three families plus the create-path error
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Red: add failing tests for edit-path clear-via-empty (--dep/--depends-on "", --ref "", --doc ""), empty + matching --clear-* coexistence, and the mixed empty+value rule; keep the create-path error tests as the unchanged baseline.
2. Green in validateClearableListInput (src/cli.ts): add an emptyClears input, passed as supportsClearFlags only for the three replacement families (--depends-on/--dep, --ref, --doc). When emptyClears is on, a blank raw value stops counting as a setter value: it no longer trips the --clear-* conflict check and no longer produces the BACK-603 empty-value error. --add-ref/--remove-ref and the whole create path keep today's behavior byte-for-byte.
3. Mixed input (empty value plus a non-empty value in the same family) stays an error with a message written for the new semantics, because an empty value is now exactly the --clear-* flag and --clear-deps --dep X already errors.
4. Make the edit path actually clear: swap parseDelimitedStringList for parseClearableStringList on options.ref/options.doc and on the merged --depends-on/--dep input (guarded on flag presence so an absent flag stays undefined). Existing 'if (values) editArgs.X = values' branches already treat [] as clear, which is the same path --clear-* uses.
5. Document the second spelling in task edit --help for --depends-on/--dep/--ref/--doc, mirroring the existing -a "" wording.
6. Verify: bunx tsc --noEmit, bun run check ., full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in the shared helpers, as scoped.

validateClearableListInput (src/cli.ts) gained an emptyClears input. When it is on, a blank raw value is not a setter value: it is filtered out before the --clear-* conflict check and it no longer produces the BACK-603 empty-value error. validateTaskListFlags passes emptyClears: supportsClearFlags for the three replacement families only (--depends-on/--dep, --ref, --doc), so task create and the incremental --add-ref/--remove-ref flags keep today's messages byte for byte.

The edit path now reads those three through parseClearableStringList instead of parseDelimitedStringList, so an explicit empty value yields [] where an absent flag still yields undefined. The existing 'if (values) editArgs.X = values' branches already treat [] as a clear (an empty array is truthy), which is the same assignment --clear-deps/--clear-refs/--clear-docs make, so serialization is identical between the two spellings. Verified in a scratch project: task edit --dep "" --ref "" --doc "" leaves dependencies: [] and drops references/documentation, matching --clear-*.

parseClearableStringList now treats an empty array as absent. That lets the merged --depends-on/--dep input pass straight through instead of needing a call-site length guard, and makes the three families read identically. No current caller passes [] (Commander accumulators give undefined when a flag is absent), so assignee behavior is unchanged.

MIXED-INPUT DECISION: an empty value alongside a non-empty value in the same family (--dep "" --dep TASK-1) sets the non-empty value; the blank is dropped and no error is raised. This mirrors BACK-604, verified empirically on main before implementing: task edit -a "" -a @bob sets @bob today. It also matches how blanks already normalize away inside a single value (--dep "TASK-1," is accepted today and yields [TASK-1]), so blank handling no longer depends on whether the blank landed in the same argv token. The alternative reading, treating the blank as a clear operation and erroring like --clear-deps --dep TASK-1 does, was rejected: the flag and the empty value are not the same kind of thing. --clear-deps is a standalone operation, while an empty --dep is an option that was supplied with no values, which is exactly the parseClearableStringList contract BACK-604 established. The --clear-* conflict checks are unchanged for value-bearing setters.

Message surface: unchanged everywhere. The only new copy is CLI help, where --depends-on/--ref/--doc on task edit now carry the same 'pass "" to clear' note -a already had. No new error strings were added.

Empty value plus the matching --clear-* flag is now accepted (AC 4) because the blank is filtered before the conflict check. --clear-refs --add-ref "" still reports the conflict message it reports on main, since add-ref does not opt into emptyClears.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
task edit now accepts an explicit empty value as a second spelling of clear for the three replacement list families: --depends-on/--dep, --ref, and --doc all behave exactly like --clear-deps/--clear-refs/--clear-docs when passed "", aligning them with the -a "" convention from BACK-604. The --clear-* flags remain and are unchanged. task create still rejects an empty value with the BACK-603 message, since a new task has no list to clear.

The change lives in the two shared helpers it was scoped to. validateClearableListInput takes an emptyClears input that validateTaskListFlags sets from supportsClearFlags for the three replacement families only; with it on, a blank value is filtered out before the --clear-* conflict check and is no longer rejected. The edit path reads those three through parseClearableStringList, so an explicit empty value produces the same [] assignment the --clear-* flags already make. No new error strings; the only new copy is the 'pass "" to clear' note added to task edit --help for the three flags.

Mixed input (--dep "" --dep TASK-1) sets TASK-1 and drops the blank, mirroring -a "" -a @bob, which was verified against main before implementing, and matching how blank segments already normalize away inside a single value.

Verified with new CLI tests for clear-via-empty across all three families, empty plus the matching --clear-* flag, and the mixed-input rule; create-path error tests were strengthened to pin the full BACK-603 message. bunx tsc --noEmit clean, bun run check . clean, full bun run test green at 2181 pass / 6 skip / 0 fail across 226 files. Behavior was also exercised by hand in a scratch project, confirming the cleared frontmatter matches what --clear-* produces.
<!-- SECTION:FINAL_SUMMARY:END -->
