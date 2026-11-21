---
id: BACK-815
title: Suggest configured labels while typing in the create form
status: Done
assignee: []
created_date: '2026-11-20T23:43:00Z'
updated_date: '2026-11-21T01:13:00Z'
labels: []
dependencies: []
ordinal: 414000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Labels in the create form are free text via ChipInput, while config.yml already holds a curated label list. Without surfacing that list during entry, users add bug, Bug and bugfix for one concept and the label set fragments. Issue #1231.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ChipInput accepts an optional suggestions prop
- [x] #2 Matching configured labels appear as the user types, case-insensitively
- [x] #3 Arrow keys plus Enter or a click inserts the exact configured spelling and casing
- [x] #4 Already selected labels are not suggested and duplicate chips are refused
- [x] #5 Free text entry for genuinely new labels still works
- [x] #6 Component tests cover filtering, selection, casing, duplicates and custom entry
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch tasks/back-815-label-suggestions. ChipInput now takes suggestions, filters them case-insensitively as the user types, supports ArrowUp/Down + Enter or click to insert exact configured casing, excludes already selected values and refuses case-insensitive duplicates, while free-text entry still works. TaskDetailsModal receives availableLabels from App.tsx and passes them only to the labels field.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Configured labels are now suggested while typing in the task create/edit labels field. Suggestions match case-insensitively, keyboard and click selection insert the exact configured label, selected labels are excluded, duplicates are refused, and new labels can still be typed. Verified: 6 new ChipInput tests pass, 8 existing TaskDetailsModal tests pass, bun run check:types clean. bun run check has 483 pre-existing diagnostics on this host, none in changed paths.
<!-- SECTION:FINAL_SUMMARY:END -->
