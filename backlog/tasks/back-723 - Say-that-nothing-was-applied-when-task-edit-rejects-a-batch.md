---
id: BACK-723
title: Say that nothing was applied when task edit rejects a batch
status: To Do
assignee: []
created_date: '2026-10-11 10:43'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1061'
type: bug
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task edit` applies all field changes in one invocation together. When one part is invalid, for example an out-of-range `--check-dod` index, the whole edit is rejected and nothing is written, but the output only names the invalid part. The only sign that the other fields were discarded is the missing `Updated task <id>` line, which is easy to miss, so a caller can believe that notes, a final summary, and checklist ticks were recorded when the task is unchanged (issue #1061, reported on 1.51.0). The issue reports the same shape for an unknown option and for a comment body that contains a reserved delimiter line.

Edits stay all-or-nothing. Applying the valid parts of a rejected edit, and a `--check-dod all` style convenience, are not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When any part of a `backlog task edit` invocation is rejected, the error output names what was rejected and states explicitly that no changes were applied to the task.
- [ ] #2 The command exits non-zero in that case.
- [ ] #3 The task is unchanged after a rejected edit: edits stay all-or-nothing.
- [ ] #4 The statement is printed whichever part of the edit was rejected, not only for checklist index errors.
- [ ] #5 The output of a successful edit is unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
