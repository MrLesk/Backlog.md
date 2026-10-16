---
id: BACK-753
title: Add a read-path benchmark for large backlogs
status: To Do
assignee: []
created_date: '2026-10-11 20:02'
labels: []
dependencies: []
priority: medium
type: chore
ordinal: 371000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Read performance on large backlogs has regressed before without anyone noticing until users reported it: version 1.50.0 made CLI commands unusably slow on real repositories (fixed in BACK-623 and BACK-624). There is no repeatable way to measure how list, view, search, board and create behave as the number of tasks and branches grows, so improvements cannot be confirmed and regressions cannot be caught. Ad hoc measurements on 2026-10-11 with generated projects of typical file size: `backlog task list --plain` took 0.31 s at 1,000 tasks, 1.09 s at 5,000 and 2.15 s at 10,000; `backlog task view` of one task took 2.21 s at 10,000.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One documented command generates a throwaway project with a chosen number of tasks and branches and reports timings for `task list`, `task view`, `search`, `board export` and `task create`.
- [ ] #2 It reports how many git processes each of those commands starts.
- [ ] #3 It runs against the built binary, leaves the repository it is run from untouched, and removes what it generated.
- [ ] #4 Results for 1,000 and 10,000 tasks, each with 10 and 500 branches, are recorded in the task as the baseline.
- [ ] #5 It is not added to CI in this task. Whether any budget should gate CI is a separate decision.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
