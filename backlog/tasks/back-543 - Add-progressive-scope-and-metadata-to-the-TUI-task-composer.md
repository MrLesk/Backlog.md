---
id: BACK-543
title: Add progressive scope and metadata to the TUI task composer
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-07-12 22:10'
labels:
  - tui
  - enhancement
milestone: m-8
dependencies:
  - BACK-430
priority: medium
type: enhancement
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the reviewed TUI composer with progressively disclosed scope and metadata after the production first slice is established. Keep capture readable, validate the complete payload before persistence, and exclude lifecycle-only execution and completion fields from creation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The composer supports assignee, labels, active milestone, parent, dependencies, references, acceptance criteria, and per-task Definition of Done using the configured or canonical choices for each field.
- [ ] #2 Scope and metadata are progressively disclosed so title and description remain the primary capture experience while all included fields remain discoverable before review.
- [ ] #3 Repeatable fields support adding, editing, removing, and clearing values with unambiguous keyboard and focus behavior.
- [ ] #4 Parent, dependency, milestone, and other canonical validation or identity ambiguity is resolved before Create, and validation failure produces no partial writes.
- [ ] #5 Plan, implementation notes, and final summary are absent from task creation because they belong to later lifecycle stages.
- [ ] #6 A complete review state precedes the explicit Create action, and Cancel exits without creating or modifying a task or draft.
- [ ] #7 Validation and persistence failures preserve all entered values for correction or retry.
- [ ] #8 Keyboard, focus, and scrolling behavior is verified in rendered TUI QA at normal and narrow terminal sizes.
- [ ] #9 Automated tests cover payload mapping, configured choices, repeatable-field add/edit/remove/clear semantics, ambiguity and validation failures, cancellation, and absence of lifecycle-only creation fields.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
