---
id: BACK-613
title: Fix content-store document watcher retry and rename reconciliation
status: To Do
assignee: []
created_date: '2026-08-09 13:49'
labels: []
dependencies: []
ordinal: 252000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by Alex 2026-08-09. Two confirmed defects in src/core/content-store.ts found during BACK-609 research: (1) the document watcher retries forever for a file named like doc-1.md (no " - Title" part): it passes the doc- prefix gate but its split(" - ") id never equals the frontmatter id, so the reconciliation loop never terminates; (2) rename reconciliation compares ids with raw equality while findDocumentById/saveDocument use documentIdsEqual, so a file like "doc-0001 - Title.md" with frontmatter id doc-1 is invisible to rename reconciliation (zero-padded ids break it). Fix both; align on documentIdsEqual as the single comparison.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A watched file named doc-1.md (no title part) does not cause endless retry; the watcher settles deterministically
- [ ] #2 Rename reconciliation matches ids via documentIdsEqual so zero-padded filenames reconcile with unpadded frontmatter ids and vice versa
- [ ] #3 Tests cover both defects red-then-green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
