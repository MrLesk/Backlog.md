---
id: BACK-613
title: Fix content-store document watcher retry and rename reconciliation
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-09 15:12'
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

Review round 1 (Codex, PR #887): all three P2 findings reproduced with the existing harness patterns, all three fixed.

(1) Resurrection through a concurrent refresh: with listDocuments gated mid-refresh, publishing the same file respelled doc-1 -> doc-0001 dropped the doc-1 map entry but versioned only doc-0001, so mergeConcurrentChanges saw doc-1 unchanged and re-added the stale copy - store ended with [doc-1, doc-0001]. Fixed by versioning every drop (new dropWatchedDocument records generation + version for the removed id, exactly as removeWatchedDocument already did).

(2) Wrong entry dropped among padding-equivalent siblings: with doc-001 'Alpha guide' and doc-01 'Beta guide' on disk, respelling Beta's frontmatter to doc-1 deleted Alpha (first equivalent in map order) and left Beta twice.

(3) Stale recheck deleting a live document: a malformed write to 'doc-0001 - Title.md' scheduled a recheck keyed document:doc-0001; after the file was repaired as 'doc-1 - Title.md' and published, firing the stale timer removed the live document by identity - the store went empty.

(2) and (3) share one root cause: the store side was matching by ID equivalence when a watcher event is about one specific FILE. Replaced findWatchedDocument(id) with findWatchedDocumentByPath(path), so publish replaces (and remove deletes) only the entry holding that path, mirroring the task watcher's filePath-based current/replacedPath design. publishWatchedDocument now takes the event path as replacedPath, which also covers a simultaneous rename plus id respell. documentIdsEqual stays where identity actually matters: the filename-vs-frontmatter checks in the watcher. Also hoisted the event path derivation into one watchedDocumentPath() helper that fails closed to a full refresh.

Follow-on found while validating the path-based design: a simultaneous rename plus id respell (file P -> Q and frontmatter doc-1 -> doc-0001) left the vacated P entry behind, because publish preferred the entry at the published path over the one at the event path. Ordering the vacated (event) path first drops it on the old-path event; covered by a fourth red-then-green test.

Round 1 verification: four red-then-green tests added (gated-refresh resurrection, padding-equivalent siblings, stale recheck against a live document, rename-with-respell), each confirmed failing on the preceding commit and passing after. bunx tsc --noEmit clean, bun run check . clean, ContentStore suite 60/60, full bun run test 2149 pass / 6 skip / 0 fail with no load flakes this round. PR #887 CI green across ubuntu, macos and windows (lint-and-unit-test, compile-and-smoke-test, nix-package, CodeQL).

Observation recorded, deliberately not changed: updateDocumentFromDisk() still reads the store map with documents.get(documentId) on the save path. It is the last raw-key document lookup, but the id there comes from the file just written, so reaching a mismatch needs a caller to pass a differently padded id than the file's frontmatter, which no current CLI path does. Outside the acceptance criteria and would need its own coverage to justify.

Review round 2 (final patch round): one thread taken, 'Remove the old entry after a destination-only respelled rename'. Reproduced: renaming 'doc-1 - Architecture Guide.md' to 'doc-0001 - Renamed guide.md' while respelling frontmatter doc-1 -> doc-0001, with only the destination event delivered, left the store showing both the stale doc-1 at the old path and the new doc-0001 - no deferred recheck involved, the single destination event creates the duplicate. The round-1 vacated-path fix cannot help because this delivery provides no vacated path to consult.

Fixed without reintroducing identity guessing: publishWatchedDocument now returns whether it landed on a path the store did not hold while an equivalent ID still sits at another path, and the watcher fails closed to refreshDocumentsFromDisk in that case. The guard is 'replaced is undefined AND an equivalent entry exists at a different path', so a genuinely new document never triggers a refresh (regression test asserts zero listDocuments calls when publishing a new file), and the accepted corrupt-repo staleness cases keep their reviewed behavior because a change event on a known path always finds its replaced entry.

Verified: red-then-green test plus the new-file no-refresh guard, bunx tsc --noEmit clean, bun run check . clean, ContentStore suite 62/62, full bun run test 2151 pass / 6 skip / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the content-store document watcher's identity handling in src/core/content-store.ts, across two rounds. Round 0 (the task's two defects): (1) a watched docs file named doc-1.md (no ' - Title' part) produced the filename id 'doc-1.md', which never equalled the frontmatter id, so reconciliation always returned retry and the file never settled or published - the id is now derived with basename(name, '.md') via one documentFilenameId() helper so both doc-N.md and 'doc-N - Title.md' resolve to doc-N, and names with no addressable document identity fall back to a full documents refresh instead of retrying; (2) rename reconciliation compared ids with raw ===, so 'doc-0001 - Title.md' with frontmatter doc-1 (and the reverse) never reconciled renames or removals - the watcher's filename-vs-frontmatter checks now use documentIdsEqual, matching findDocumentById/saveDocument.

Round 1 (three Codex P2 findings, all reproduced, plus one residual found while validating the fix) replaced the round-0 store-side ID-equivalence lookup with path identity: a watcher event is about one FILE, so findWatchedDocumentByPath() decides which entry publish replaces and remove deletes, mirroring the task watcher's filePath-based current/replacedPath design; dropWatchedDocument() versions every removal so a concurrent refresh cannot resurrect a dropped id; and watchedDocumentPath() derives the event path once, failing closed to a full refresh. This fixed: resurrection of a respelled id through an in-flight refresh merge, deletion of the wrong entry among padding-equivalent siblings, deletion of a live document by a stale recheck for an absent path, and a vacated entry left behind by a simultaneous rename plus respell.

Verified with seven new red-then-green tests in src/test/content-store.test.ts, each failing on the preceding commit: untitled-filename settle (asserting deferredRechecks.size 0), padded/unpadded rename plus deletion, frontmatter padding change, gated-refresh resurrection, padding-equivalent siblings, stale recheck against a live document, and rename-with-respell. Plus a scratch harness showing the pre-fix 11-timer retry chain and its post-fix absence, bunx tsc --noEmit clean, bun run check . clean, ContentStore suite 60/60, full bun run test at 2149 pass / 6 skip / 0 fail, and PR #887 CI green on ubuntu, macos and windows.
<!-- SECTION:FINAL_SUMMARY:END -->
