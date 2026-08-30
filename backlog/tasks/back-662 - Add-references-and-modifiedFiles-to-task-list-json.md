---
id: BACK-662
title: Add references and modifiedFiles to task list --json
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 19:00'
updated_date: '2026-08-30 19:06'
labels:
  - cli
dependencies: []
ordinal: 294000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
External tools consuming `backlog task list --json` need each task's references and modifiedFiles without fetching tasks one by one. Add both arrays to the task summary JSON projection. Additive under schemaVersion 1; task view --json already carries them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each task in `task list --json` includes references and modifiedFiles arrays (empty arrays when unset)
- [ ] #2 task view --json output is unchanged
- [ ] #3 Tests cover populated and empty cases
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add references and modifiedFiles to TaskSummaryJson (shared by list and search task rows), remove the duplicate declarations from TaskDetailsJson, populate in toTaskSummaryJson, update the list test and CLI-INSTRUCTIONS field enumeration.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in json-output.ts by moving the two fields into the shared summary projection; view payload content unchanged. Docs updated. Empty case covered by a dedicated assertion on a task without references or modified files.
<!-- SECTION:NOTES:END -->
