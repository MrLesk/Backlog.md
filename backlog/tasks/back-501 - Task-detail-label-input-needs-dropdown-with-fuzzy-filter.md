---
id: BACK-501
title: Task detail label input needs dropdown with fuzzy filter
status: Done
assignee:
  - Kimi
created_date: '2026-05-30 02:04'
updated_date: '2026-05-30 03:17'
labels:
  - web-ui
  - enhancement
dependencies: []
priority: medium
ordinal: 160400
actual_start: '2026-05-30 01:17'
actual_end: '2026-05-30 03:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task details modal currently uses a plain ChipInput for labels, allowing free-text entry without any guidance. This leads to inconsistent label names (e.g., 'bug' vs 'Bug' vs 'BUG'), orphaned typos, and users forgetting what labels already exist in the project.

Requirements:
1. Add an autocomplete dropdown to the label ChipInput in TaskDetailsModal that shows available labels from the project config.
2. Support fuzzy filtering: as the user types, filter the dropdown list to matching labels.
3. Allow creating new labels if the typed text does not match any existing label.
4. Prevent or warn about near-duplicate labels (case-insensitive matching) to keep the label set clean.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Label input in TaskDetailsModal shows a dropdown of existing project labels on focus or typing
- [x] #2 Dropdown supports fuzzy search filtering as user types
- [x] #3 User can select an existing label from the dropdown or create a new one by pressing Enter
- [x] #4 Case-insensitive duplicate detection prevents adding labels that already exist with different casing
- [x] #5 Dropdown closes on outside click, Escape, or selection
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add case-insensitive duplicate guard logic
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Estimated files: src/web/components/ChipInput.tsx or a new wrapper, src/web/components/TaskDetailsModal.tsx
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
