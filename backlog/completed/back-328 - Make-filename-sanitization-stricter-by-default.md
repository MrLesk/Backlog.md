---
id: BACK-328
title: Make filename sanitization stricter by default
status: Done
assignee:
  - '@codex'
created_date: '2025-12-01 21:54'
updated_date: '2025-12-01 22:47'
labels:
  - feature
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the stricter slug behavior discussed in issue #435 so filenames drop punctuation like quotes/parentheses and collapse dashes, with no config toggle. Ensure existing tasks/decisions/docs still load by ID even if filenames change on save, and document/update tests accordingly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Filename sanitization removes the specified punctuation and still collapses duplicate dashes/trim edges.
- [x] #2 Behavior is the single default (no config flag) applied to tasks, drafts, decisions, and docs.
- [x] #3 Tests cover the new slug rules and confirm existing files can still be loaded by ID.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Ensure decision save removes legacy filenames so new sanitized filenames remain canonical.
- Keep stricter sanitizeFilename behavior consistent across tasks/drafts/decisions/docs.
- Add regression tests for decision legacy filenames; rerun checks/tests and summarize impacts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented stricter default filename sanitization (drops punctuation like quotes/parentheses and collapses dashes) shared across tasks/drafts/decisions/docs.

Added filesystem tests covering the new slug output, legacy filename loading by ID, and sanitized decisions/documents.

bun test src/test/filesystem.test.ts

Handled legacy decision filenames by cleaning up old files during save to keep sanitized slug canonical; added regression coverage in filesystem tests.

bun test src/test/filesystem.test.ts

Adding extra test coverage for multiple problematic task titles.

Added table-driven test covering multiple problematic task titles to confirm sanitized filenames.
<!-- SECTION:NOTES:END -->
