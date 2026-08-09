---
id: BACK-618
title: Accept an explicit empty value as a clear on task edit list flags
status: To Do
assignee: []
created_date: '2026-08-09 16:05'
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
- [ ] #1 task edit --dep "" clears dependencies, equivalent to --clear-deps
- [ ] #2 task edit --ref "" and --doc "" clear their lists the same way
- [ ] #3 task create with an empty value for these flags still errors with the BACK-603 message
- [ ] #4 Combining an empty value with the corresponding --clear-* flag is not an error (same meaning), and --clear-* flags keep working alone
- [ ] #5 Tests cover clear-via-empty on edit for all three families plus the create-path error
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
