---
id: BACK-613
title: Fix content-store document watcher retry and rename reconciliation
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-09 14:08'
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
- [x] #1 A watched file named doc-1.md (no title part) does not cause endless retry; the watcher settles deterministically
- [x] #2 Rename reconciliation matches ids via documentIdsEqual so zero-padded filenames reconcile with unpadded frontmatter ids and vice versa
- [x] #3 Tests cover both defects red-then-green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce both defects with new red tests in src/test/content-store.test.ts: (a) a docs file named doc-1.md (no ' - Title' part) never settles - the filename id 'doc-1.md' never equals frontmatter 'doc-1', so reconcile keeps returning retry and the change is never published; (b) rename reconciliation for 'doc-0001 - Title.md' with frontmatter doc-1 throws identity mismatch (and removeWatchedDocument misses the map entry), so renames/deletions of zero-padded files are invisible.
2. Fix id derivation in createDocumentWatcher: derive the filename id from basename(base, '.md').split(' - ')[0] so both doc-N.md and 'doc-N - Title.md' yield doc-N, and fall back to a full documents refresh when the derived id has no addressable body (documentIdKey === null) instead of the current truthiness-only guard.
3. Replace raw === id comparisons in the document watcher (readEventPath, findIdentity filter, candidate reader, non-rename reconcile) with documentIdsEqual, matching findDocumentById/saveDocument.
4. Make the store-side lookups identity-aware so rename/delete reconciliation finds the entry stored under the frontmatter id: resolve via documentIdsEqual in the watcher 'current' callback and in removeWatchedDocument.
5. Verify: new tests red before / green after, bunx tsc --noEmit, bun run check ., targeted content-store + document tests, then full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repro (pre-fix, scratch harness draining the deferred-recheck timers from one watcher event on backlog/docs/doc-1.md): recheck key was 'document:doc-1.md' and the file burned the full retry chain (delays 75,150,...,825ms) without ever publishing - the store kept the stale 'guide' type. Root cause: the watcher derived the id with base.split(' - ') on a name that still carried the '.md' extension, so 'doc-1.md' produced the id 'doc-1.md', which never equals the frontmatter id 'doc-1'; every mismatch returned retry, so reconciliation never settled and each new event restarted the chain. Post-fix the same harness settles on the first pass: no deferred rechecks, type published immediately.

Defect 2 repro: 'doc-0001 - Architecture Guide.md' with frontmatter doc-1 (and the mirror case 'doc-2 - Implementation Notes.md' with frontmatter doc-0002) stayed on the old path after a rename because readEventPath threw 'Document identity mismatch' on raw ===; removeWatchedDocument also missed the map entry stored under the frontmatter id, so deletions were invisible.

Fix (src/core/content-store.ts): one module-level documentFilenameId() derives the id from basename(name, '.md').split(' - ')[0] for both filename shapes and returns null when the name carries no addressable document identity, which collapses the old 'doc-' prefix gate and the empty-id gate into a single deterministic full-refresh fallback. All document watcher comparisons now use documentIdsEqual (readEventPath, findIdentity filter, candidate reader, non-rename reconcile), and store-side lookups go through one findWatchedDocument() helper used by the rename 'current' callback, the non-rename previous lookup, removeWatchedDocument, and publishWatchedDocument (which now drops an equal-identity entry stored under a differently spelled id, so a frontmatter padding change cannot leave two entries for one file).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed two document-watcher identity defects in src/core/content-store.ts. (1) A watched docs file named doc-1.md (no ' - Title' part) produced the filename id 'doc-1.md', which never equalled the frontmatter id, so reconciliation always returned retry and the file never settled or published; the id is now derived with basename(name, '.md') so both doc-N.md and 'doc-N - Title.md' resolve to doc-N, and names without an addressable document identity fall back to a full documents refresh instead of retrying. (2) Rename reconciliation compared ids with raw === and read the store map by exact key, so 'doc-0001 - Title.md' with frontmatter doc-1 (and the reverse) never reconciled renames and never removed deletions; all document watcher comparisons now use documentIdsEqual and store lookups go through one findWatchedDocument helper, which also prevents a frontmatter padding change from leaving two entries for the same file. Verified with three new red-then-green tests in src/test/content-store.test.ts (untitled-filename settle including deferredRechecks.size 0, padded/unpadded rename plus deletion, frontmatter padding change), a scratch harness showing the pre-fix 11-timer retry chain and its post-fix absence, bunx tsc --noEmit clean, bun run check . clean, and bun run test green at 2145 pass / 6 skip / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
