---
id: BACK-817
title: Suggest configured labels in the browser task form
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T12:26:49Z'
updated_date: '2026-11-21T12:35:09Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1231
  - src/web/App.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/ChipInput.tsx
modified_files:
  - src/test/web-task-details-modal-keyboard-shortcuts.test.tsx
  - src/web/App.tsx
  - src/web/components/Modal.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/ChipInput.tsx
priority: low
type: enhancement
ordinal: 415000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A project can define a spelling for each label, but people creating or editing tasks currently have to remember it. The browser accepts both Bug and bug on a single task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Typing in the task label field suggests matching configured labels case-insensitively and omits labels already selected.
- [x] #2 Keyboard and pointer selection add the configured spelling. A label already on the task cannot be added twice with different casing.
- [x] #3 Free-text labels can still be added in create and edit flows, and changing labels preserves unrelated fields.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Exercise configured label suggestions through the browser task form, including a new label and a differently cased duplicate. 2. Pass the configured labels into the existing label input and keep its entry and removal behavior for free text. 3. Verify keyboard and pointer selection in a browser, the create and edit paths, and the existing assignee input.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The browser label field offers configured labels as the user types, keeps their spelling when picked, and accepts custom labels. Keyboard and mouse both work. A second spelling of a selected label is refused. The build, types, Biome, and 80 focused tests passed. A Chrome run created and edited a task with configured and custom labels, then checked the saved labels, title, and assignee.
<!-- SECTION:FINAL_SUMMARY:END -->
