---
id: BACK-628
title: >-
  Stop findIdentity rename fallback from publishing freshness without installing
  the corpus
status: Done
assignee:
  - '@claude'
created_date: '2026-08-10 06:37'
updated_date: '2026-08-29 18:32'
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

Maintainer review (takeover of PR #926): accepted the implementation as submitted. Verified the diagnosis against the invariant already documented in loadTasksWithStableBranchSnapshot (src/core/backlog.ts): 'Only the corpus this Core installs into its ContentStore may advance shared freshness state.' The findIdentity rename fallback was exactly such a standalone load, so opting it out with publish:false enforces the stated rule rather than adding a new one. Confirmed the other two loadTasksWithLoader call sites (loadCurrentContent and refreshTasksFromDisk, content-store.ts) do install the corpus they load, so leaving them publishing is correct and AC #3 holds.

Independently reproduced the regression: reverting only src/core/backlog.ts and src/core/content-store.ts to main makes the new test fail deterministically across repeated runs ('Before ref move' instead of 'After ref move'), and it passes with the fix. Extracting waitUntil into test-utils.ts is a genuine dedup rather than a new helper, so it fits the simplicity rules.

Rebased from the stale base (BACK-222.1, PR #921) onto current origin/main. The rebase absorbed the pure-reformatting hunks the PR previously carried in backlog.ts and content-store.ts -- main has since been formatted -- so the diff is now confined to the fix, its test, and the shared helper. The earlier note listing pre-existing Biome findings in file-system/operations.ts, server/index.ts and ui/board.ts is therefore stale; only src/ui/components/task-composer.ts is still unformatted on main, and it is untouched here.

Noted but not changed (pre-existing, out of scope): content-store.ts refreshTasksFromDisk still does 'corpus = Array.isArray(loaded) ? this.asTaskCorpus(loaded) : loaded' on the result of loadTasksWithLoader, which already normalizes and is typed TaskCorpusSnapshot, so that branch is dead.

Correction to the verification note above: the two src/test/core.test.ts failures ('fails closed when an archive snapshot...' and 'keeps an ID occupied when equal-time branch records...') were NOT environmental and not caused by this branch. They were a time-bomb in main's own tests -- hardcoded commit dates that aged out of the activeBranchDays window -- and they failed on CI too. Upstream fixed them in main commit 6c6f1843 'Fix expired hardcoded commit dates in core branch-record tests'. This branch has been rebased onto current origin/main (b2fbf08d) past that fix, and the suite is clean again.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed ContentStore.findIdentity's rename-fallback so its throwaway corpus load no longer advances Core.activeBranchFingerprint. The fallback loads the full task corpus purely to resolve one task's identity and then discards it, but it went through the same publishing loader the store uses to install shared cross-branch state. Publishing on that load made every later read believe the store already held the current branch tips, so refreshTasksForTaskRead skipped store.refreshTasks() and served the pre-move corpus until an unrelated ref or config change forced a refresh.

Threaded an optional { publish?: boolean } through ContentStore's taskLoader signature and loadTasksWithLoader (src/core/content-store.ts) and through Core.loadContentStoreCorpus (src/core/backlog.ts), defaulting to publish: true. The fallback now passes publish: false; loadCurrentContent and refreshTasksFromDisk keep publishing because they do install the corpus they load, preserving publish-on-equal-corpus behavior (AC #3). This enforces the rule already stated in loadTasksWithStableBranchSnapshot rather than introducing a new one. Also extracted the duplicated waitUntil test helper into src/test/test-utils.ts.

Added a regression test in src/test/core-task-corpus-regressions.test.ts reproducing the reviewer's repro: warm the corpus, move a branch tip out-of-band from a second worktree, delete a local-only task with no branch-side copy to trigger the fallback, then assert a later read observes the moved tip. Verified it fails deterministically with only the two source files reverted to main ('Before ref move') and passes with the fix, across repeated runs.

Verified on the rebased head: bunx tsc --noEmit clean; Biome clean on all touched files; full bun run test 2408 pass / 7 skip / 2 fail. The 2 failures are in src/test/core.test.ts ('fails closed when an archive snapshot...' and 'keeps an ID occupied when equal-time branch records...'), are unrelated to this change, and are environmental on this machine rather than a main regression: they fail identically on pristine origin/main and even at BACK-557's commit 55f36422 that introduced them. Separately, bun run check . is red on main for an unformatted src/ui/components/task-composer.ts, untouched here.
<!-- SECTION:FINAL_SUMMARY:END -->
