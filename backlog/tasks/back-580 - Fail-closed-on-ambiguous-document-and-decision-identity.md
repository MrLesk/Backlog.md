---
id: BACK-580
title: Fail closed on ambiguous document and decision identity
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/846'
  - 'https://github.com/MrLesk/Backlog.md/issues/847'
priority: medium
type: bug
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issues #846 and #847. Document and decision identity resolves silently instead of failing closed, which violates the manifesto principle of failing closed on ambiguous identity.

- Duplicate document and decision IDs are silently resolved by title sort order (docs are sorted by title at src/file-system/operations.ts:1014-1015 and getDocument returns the first match at src/core/backlog.ts:690-693), so retitling a document can silently re-point an ID to a different file.
- `backlog doctor` scans only tasks (src/cli.ts:4696-4723), so duplicate doc and decision IDs are never reported.
- A document with no `id:` in its frontmatter is listed and searchable but unaddressable except through the empty string (listDocuments pushes unconditionally at src/file-system/operations.ts:993-1015, and documentIdsEqual("", "") returns true via src/utils/document-id.ts:18-25).

Maintainer context: docs and decisions operations lag well behind tasks, and equivalent solutions already exist on the tasks path (for example src/core/duplicate-task-repair.ts). Reuse those existing patterns instead of inventing new machinery.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog doctor` detects duplicate document IDs
- [ ] #2 `backlog doctor` detects duplicate decision IDs
- [ ] #3 Looking up an ambiguous document or decision ID fails with a clear error instead of silently picking a winner
- [ ] #4 The empty-string ID no longer resolves to any document
- [ ] #5 Documents missing an `id:` in frontmatter are surfaced as malformed rather than silently half-usable
- [ ] #6 Tests cover duplicate detection, ambiguous lookup failure, the empty-string ID, and documents missing an id
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
