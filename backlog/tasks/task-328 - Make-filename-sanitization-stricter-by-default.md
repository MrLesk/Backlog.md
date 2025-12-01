---
id: task-328
title: Make filename sanitization stricter by default
status: Done
assignee:
  - '@codex'
created_date: '2025-12-01 21:54'
updated_date: '2025-12-01 21:57'
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
- Update sanitizeFilename to drop additional punctuation while keeping dash collapsing and trimming.
- Add focused tests covering the new slug output and backward compatibility (loading existing files by ID).
- Run relevant tests and summarize impact (note renames on save).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented stricter default filename sanitization (drops punctuation like quotes/parentheses and collapses dashes) shared across tasks/drafts/decisions/docs.

Added filesystem tests covering the new slug output, legacy filename loading by ID, and sanitized decisions/documents.

bun test src/test/filesystem.test.ts
<!-- SECTION:NOTES:END -->
