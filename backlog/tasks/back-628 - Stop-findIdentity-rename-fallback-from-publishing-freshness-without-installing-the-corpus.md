---
id: BACK-628
title: >-
  Stop findIdentity rename fallback from publishing freshness without installing
  the corpus
status: Done
assignee:
  - '@claude'
created_date: '2026-08-10 06:37'
updated_date: '2026-08-20 21:54'
labels: []
dependencies: []
priority: medium
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing defect found during the PR #899 (BACK-624) verification round; it reproduces on the PR #898 base too, so it is not a #899 regression. When a task file is renamed or deleted away with no matching local candidate, ContentStore.findIdentity's fallback (src/core/content-store.ts:1051 at head 48ecde4d of tasks/back-624-shared-task-loading) loads the full corpus through the publishing loader purely for a single-task identity lookup and never installs the result. That advances activeBranchFingerprint, so a branch tip that moved just before is then treated as already-seen: reproduced serving stale branch state indefinitely until the next ref or config change. Narrow trigger (deleting a task with no branch-side copy; branch-fallback hydration otherwise forces a healing refresh) and self-heals on any later ref change. Fix direction: findIdentity should either install the corpus it loaded or use a non-publishing load; note refreshTasksFromDisk's publish-on-equal-corpus at :1591 must keep publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The findIdentity fallback either installs the corpus it loads or performs a non-publishing load
- [x] #2 The reviewer's repro (tip move, then rename/delete of a task with no branch copy, then read) serves fresh branch state
- [x] #3 Publish-on-equal-corpus behavior in refreshTasksFromDisk is preserved
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend ContentStore's taskLoader signature and loadTasksWithLoader() (src/core/content-store.ts) to accept an optional { publish?: boolean } option.
2. In the findIdentity rename-fallback (content-store.ts ~line 1056), call loadTasksWithLoader with { publish: false } instead of the bare publishing call.
3. Thread the option through Core.loadContentStoreCorpus and the ContentStore constructor closure in src/core/backlog.ts, so a non-publishing load skips advancing activeBranchFingerprint while the two legitimate call sites (loadCurrentContent, refreshTasksFromDisk) keep publishing as today.
4. Extract the local waitUntil() polling helper from src/test/content-store.test.ts into src/test/test-utils.ts (exported) so it can be reused instead of duplicated.
5. Add a regression test in src/test/core-task-corpus-regressions.test.ts modeled on "keeps serving fresh branch state after an ID allocation that never installed a corpus": warm the shared corpus, move a branch tip out-of-band via a worktree, delete a local-only task with no branch-side copy (triggering the findIdentity fallback), then assert a subsequent read observes the moved branch tip's fresh content. Verify it fails pre-fix and passes post-fix (stash technique).
6. Run bunx tsc --noEmit, bun run check ., and the full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: ContentStore.findIdentity's rename-fallback (content-store.ts) called this.loadTasksWithLoader() with no options, which is wired to Core.loadContentStoreCorpus (backlog.ts) - the same publishing loader used by refreshTasksFromDisk/loadCurrentContent. That loader unconditionally set publishSharedState:true, advancing Core.activeBranchFingerprint to the current (possibly just-moved) branch tip even though the fallback only used the result to resolve one task's identity and discarded the rest. A later refreshTasksForTaskRead() then saw the fingerprint already match and skipped the full store.refreshTasks(), serving the pre-move corpus indefinitely.

Fix: threaded an optional { publish?: boolean } through ContentStore's taskLoader signature and loadTasksWithLoader(), and through Core.loadContentStoreCorpus (publishSharedState defaults to true, preserving refreshTasksFromDisk/loadCurrentContent behavior). The findIdentity fallback now calls loadTasksWithLoader(undefined, { publish: false }), so its throwaway load never advances activeBranchFingerprint.

Test: added "keeps serving fresh branch state after a rename fallback that never installed a corpus" in core-task-corpus-regressions.test.ts, modeled on the existing ID-allocation freshness test. Verified with the stash technique: fails pre-fix (observed "Before ref move" instead of "After ref move"), passes post-fix.

Also extracted the duplicated local waitUntil() polling helper (previously only in content-store.test.ts) into test-utils.ts so both test files share it.

Verification: bunx tsc --noEmit clean; bun run check on touched files clean (pre-existing unrelated Biome findings in file-system/operations.ts, server/index.ts, ui/board.ts, task-composer.ts left untouched - out of scope); full bun run test: 2340 pass / 6 skip / 0 fail across 243 files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed ContentStore.findIdentity's rename-fallback so its throwaway single-task corpus load no longer advances Core.activeBranchFingerprint. Threaded an optional { publish: false } through the taskLoader signature (content-store.ts) and Core.loadContentStoreCorpus (backlog.ts); the fallback now opts out while refreshTasksFromDisk and loadCurrentContent keep publishing as before, preserving publish-on-equal-corpus behavior. Added a regression test that reproduces the reviewer's exact repro (branch tip moved out-of-band, then a local-only task with no branch copy is deleted, then a read) and verified it fails pre-fix / passes post-fix via git stash. Full suite: 2340 pass / 6 skip / 0 fail; tsc and Biome clean on touched files.
<!-- SECTION:FINAL_SUMMARY:END -->
