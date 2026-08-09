---
id: BACK-622
title: Return acceptance criteria progress in task JSON outputs
status: To Do
assignee:
  - '@codex'
created_date: '2026-08-09 21:52'
labels: []
dependencies: []
ordinal: 260000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Machine-readable task summaries currently omit acceptance-criteria progress, so consumers must load and inspect full checklist data. Return the completed acceptance-criteria count and total acceptance-criteria count consistently anywhere the canonical CLI emits task list or task detail JSON, including task results in search output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task list JSON includes completed and total acceptance-criteria counts for every task summary
- [ ] #2 Task detail JSON includes the same acceptance-criteria counts alongside the full checklist
- [ ] #3 Task results in search JSON use the same acceptance-criteria count fields as task list output
- [ ] #4 Tasks without acceptance criteria return zero for both counts
- [ ] #5 Focused automated tests cover complete, partial, and empty acceptance-criteria progress
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
