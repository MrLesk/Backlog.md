---
id: BACK-839
title: View and edit a milestone's description after creation
status: Done
assignee: []
created_date: '2026-11-26T22:40:41Z'
updated_date: '2026-11-26T23:44:19Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1265
ordinal: 438000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A milestone description can only be set when the milestone is created. The web Milestones page never shows it, and no surface can change it afterwards, so the only option is editing the milestone file by hand. Requested in https://github.com/MrLesk/Backlog.md/issues/1265.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestone cards on the web Milestones page do not show the description
- [x] #2 Clicking a milestone's name opens a details dialog that shows its due date and description as Markdown, treating the default 'Milestone: <title>' text as no description
- [x] #3 The web Edit milestone dialog, opened from the card or the details dialog, edits the description in the same Markdown editor the task view uses
- [x] #4 PUT /api/milestones/:id accepts an optional description string and rejects other types with 400
- [x] #5 backlog milestone rename and MCP milestone_rename accept a description that replaces the Description section and keeps other sections
- [x] #6 A change to the description alone is saved, not reported as a no-op
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Let FileSystem.renameMilestone replace the Description section body, keeping the default-title rewrite when no description is given.
2. Thread description through Core.renameMilestone and MilestoneHandlers.renameMilestone, including rollbacks.
3. Accept description in PUT /api/milestones/:id, the CLI rename command and the MCP rename schema.
4. Make the milestone name on each card open a details dialog with the rendered description and an Edit action.
5. Widen the Edit milestone dialog and edit the description with the task view's Markdown editor.
6. Cover the shared handler, the HTTP contract and the page dialogs with tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Milestone descriptions can be read in a details dialog opened from the milestone's name on the web Milestones page, and edited in a wider Edit milestone dialog with the task view's Markdown editor. Cards stay compact and do not show the description. PUT /api/milestones/:id, backlog milestone rename --description and MCP milestone_rename accept a description; only the Description section is rewritten.
<!-- SECTION:FINAL_SUMMARY:END -->
