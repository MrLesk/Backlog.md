---
id: BACK-433
title: Make task edit preserve unrelated file details
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-25 12:15'
updated_date: '2026-04-25 12:24'
labels:
  - cli
  - core
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/603'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #603: editing one field should not rename, recase, or otherwise rewrite unrelated task file details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Editing a single task field preserves the task ID casing, filename identity, and unrelated metadata/content.
- [x] #2 A label-only edit does not inject or remove unrelated markers or sections.
- [x] #3 Regression tests cover the issue's task create/edit script or an equivalent fixture.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve existing task file paths during task updates while keeping create-time filename generation unchanged.
2. Preserve existing on-disk task ID casing during existing-file writes while keeping normalized IDs for loaded API results.
3. Update serialization so parsed body sections and checklists are rewritten only when their values actually change.
4. Cover issue #603 with a label-only regression fixture that preserves filename, id casing, legacy description, and unrelated sections.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented preservation in saveTask and serializeTask, then added a regression fixture matching GitHub issue #603. Targeted tests, TypeScript, changed-file Biome, affected suites, and full bun test pass. Full bun run check . is blocked by existing package.json formatting on origin/main, so the formatting DoD remains unchecked.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
