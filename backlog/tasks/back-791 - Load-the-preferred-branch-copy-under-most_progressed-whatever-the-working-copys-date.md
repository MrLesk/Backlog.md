---
id: BACK-791
title: >-
  Load the preferred branch copy under most_progressed whatever the working
  copy's date
status: Done
assignee: []
created_date: '2026-10-24T07:34:00Z'
updated_date: '2026-10-24T07:34:00Z'
labels: []
dependencies: []
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
chooseWinners hydrates a task's branch copy under most_progressed only when some branch commit is newer than the working copy's updated_date. An edit to the task in the working copy after its branch's last commit (a label added, a plan recorded) therefore hides the branch's further status until the branch commits again, although the working copy's date says nothing about which copy's status is further along.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Under most_progressed every branch copy of a task whose content differs from the working copy's is hydrated, even when the working copy's updated_date is later than the branch's last commit and another branch holds a newer copy
- [x] #2 Under most_recent a branch copy older than the working copy is still not read
- [x] #3 A branch copy identical to the working copy is not read, and identical blobs on different branches are read once
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
List each branch tree with blob ids (GitOperations.listTreeBlobs) and hash each working-copy file the way Git does; under most_progressed hydrate every branch copy whose blob differs from the working copy's, once per distinct blob, and let the identity index compare the statuses; key the task cache by blob id; keep most_recent's time gate. Adjust the loader tests that count reads and the test doubles that fake the tree listing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cost: one read per branch copy that differs from the working copy, which on most repositories is few; a board read on a repository with about 900 tasks and 40 active branches went from 2.6 s to 2.2 s. The newest copy per task was not enough: after an edit on main, main's own copy on the remote is the newest and hid the branch's older In Progress copy.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Under most_progressed every branch copy that differs from the working copy is read whatever the dates, identical copies are skipped, and most_recent keeps its time gate.
<!-- SECTION:FINAL_SUMMARY:END -->
