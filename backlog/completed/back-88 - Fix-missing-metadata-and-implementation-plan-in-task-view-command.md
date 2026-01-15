---
id: BACK-88
title: Fix missing metadata and implementation plan in task view command
status: Done
assignee:
  - '@claude'
created_date: '2025-06-19'
updated_date: '2025-06-19'
labels:
  - bug
  - cli
dependencies: []
---

## Description

The task view command (backlog task <id>) is not displaying all task information. It currently only shows Description and Acceptance Criteria sections, but is missing metadata (status, assignee, labels, dates) and the Implementation Plan section if present.

## Acceptance Criteria

- [x] Task view displays all metadata (status, assignee, labels, created/updated dates)
- [x] Implementation Plan section is shown if present
- [x] Implementation Notes section is shown if present
- [x] All sections maintain proper formatting
- [x] Plain mode (--plain) also includes all information
- [x] Interactive (non-plain) mode shows the same complete information as plain mode

## Implementation Plan

1. Update the `formatTaskPlainText` function to properly display all task metadata
2. Extract and display Implementation Plan and Implementation Notes sections from content
3. Update the interactive view (`viewTaskEnhanced`) to show these sections
4. Ensure both plain and interactive modes show consistent information

## Implementation Notes

### Approach
Fixed the task view command to display complete task information in both plain and interactive modes.

### Technical Changes
1. **Modified `/src/cli.ts`**:
   - Line 500: Changed plain mode output to use `formatTaskPlainText` instead of raw content
   - Line 567: Fixed the shortcut command (`task <id> --plain`) to also use `formatTaskPlainText`

2. **Enhanced `/src/ui/task-viewer.ts`**:
   - Added `extractImplementationPlanSection` function to extract Implementation Plan from markdown
   - Added `extractImplementationNotesSection` function to extract Implementation Notes from markdown
   - Updated `formatTaskPlainText` to display all metadata and sections in plain mode
   - Updated `refreshDetailPane` in `viewTaskEnhanced` to show Implementation Plan and Notes in interactive mode
   - Updated `generateDetailContent` to include these sections for the task popup view
   - Exported `formatTaskPlainText` for use in CLI

3. **Updated test expectations**:
   - Modified `/src/test/cli-plain-output.test.ts` to expect formatted output instead of raw markdown

### Results
- Plain mode (`--plain`) now shows all metadata (status, assignee, labels, dates) at the top
- Both Implementation Plan and Implementation Notes sections are displayed when present
- Interactive mode shows the same complete information as plain mode
- All tests pass and code adheres to project formatting standards
