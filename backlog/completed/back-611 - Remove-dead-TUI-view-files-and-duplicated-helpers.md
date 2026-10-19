---
id: BACK-611
title: Remove dead TUI view files and duplicated helpers
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 21:53'
updated_date: '2026-08-08 22:08'
labels: []
dependencies: []
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by Alex on 2026-08-08. Two cleanups, both confirmed during the Aug 2026 review rounds: (1) src/ui/enhanced-views.ts (runEnhancedViews) and src/ui/simple-unified-view.ts (runSimpleUnifiedView) have zero importers outside themselves (verified twice, in the BACK-605 implementation and its review) and only received plumbing churn in BACK-605; delete them and their now-unused exports/tests. (2) src/cli.ts carries an unused duplicate of generateNextDocId that also lives in src/utils/id-generators.ts; remove the duplicate and keep the shared one. Re-verify zero usages at implementation time before deleting.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 src/ui/enhanced-views.ts and src/ui/simple-unified-view.ts are deleted along with any exports and tests that exist only for them
- [x] #2 The duplicated generateNextDocId in src/cli.ts is removed in favor of the shared helper
- [x] #3 A repo-wide search confirms no remaining references to the deleted symbols
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-verify both deletions against current main: repo-wide grep (all file types, hidden dirs, excluding node_modules/.git) for enhanced-views, runEnhancedViews, EnhancedViewOptions, simple-unified-view, runSimpleUnifiedView, SimpleUnifiedViewOptions, and for generateNextDocId importers of src/cli.ts (including the dynamic 'await import("../cli.js")' path used by core/backlog.ts).
2. Delete src/ui/enhanced-views.ts and src/ui/simple-unified-view.ts. No tests exist for either file, and their only re-export (ViewSwitcher from view-switcher.ts) is a self-contained convenience re-export with no consumers, so nothing else needs editing.
3. Delete the unused exported generateNextDocId from src/cli.ts (lines 1664-1730), byte-identical to the canonical src/utils/id-generators.ts copy that core/backlog.ts already imports. Zero callers, so no call sites to repoint. Leave generateNextDecisionId in cli.ts alone: it is live (cli.ts:4410 and the dynamic import in core/backlog.ts:2876).
4. Do not cascade: view-switcher.ts stays (unified-view.ts + tests use it) and the onTabPress option stays (unified-view.ts uses it). Report anything else that looks dead rather than deleting it.
5. Verify: repo-wide grep showing zero remaining references, bunx tsc --noEmit, bun run check ., full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Re-verified both deletions against current main before removing anything.

Deleted files: src/ui/enhanced-views.ts (runEnhancedViews, EnhancedViewOptions, plus a convenience re-export of ViewSwitcher/ViewState/ViewType) and src/ui/simple-unified-view.ts (runSimpleUnifiedView, SimpleUnifiedViewOptions). A repo-wide grep across every file type including hidden directories found zero references outside the two files themselves; the only other hits were historical Backlog task markdown (BACK-345.06, BACK-355.05, BACK-577, BACK-605), which is preserved project history and was left untouched. Neither file had a test of its own, so no tests were removed.

Deleted from src/cli.ts: the exported generateNextDocId (67 lines), byte-identical to src/utils/id-generators.ts (verified by diffing the two extracted ranges). It had zero callers - core/backlog.ts already imports the shared helper statically at line 37 - so no call sites needed repointing. generateNextDecisionId in cli.ts was deliberately left in place: it is live via cli.ts:4410 and the dynamic 'await import("../cli.js")' in core/backlog.ts:2876.

No cascading deletions. view-switcher.ts survives (unified-view.ts imports it, and view-switcher.test.ts, board-command.test.ts and board-core-view-integration.test.ts exercise it). The onTabPress option on renderBoardTui and viewTaskEnhanced also survives because unified-view.ts uses it. runUnifiedView and every live TUI path are untouched.

Verification: repo-wide grep after deletion returns zero matches for enhanced-views, runEnhancedViews, EnhancedViewOptions, simple-unified-view, runSimpleUnifiedView and SimpleUnifiedViewOptions, and generateNextDocId now resolves to exactly one definition (src/utils/id-generators.ts:8) with one consumer (src/core/backlog.ts). bunx tsc --noEmit clean, bun run check . clean (367 files), bun run build succeeds, and the full bun run test suite is 2100 pass / 6 skip / 0 fail across 223 files. Behavioral spot-check with the built binary in a scratch project: doc create allocated doc-1 then doc-2 sequentially through the surviving shared helper, and board export still rendered.

Two dead-code observations left unfixed and unexpanded, per the task's non-goals: core/backlog.ts reaches generateNextDecisionId through a dynamic import of ../cli.js while taking generateNextDocId from utils/id-generators.ts, an asymmetry that would be resolved by moving the decision path onto the shared helper too; and src/ui/enhanced-views.ts carried a trailing 'Helper function import' comment with no import under it, now gone with the file.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed two dead TUI view modules and one duplicated helper, with no behavior change. src/ui/enhanced-views.ts and src/ui/simple-unified-view.ts are deleted: both had zero importers anywhere in the repo and no tests of their own, and their only outward-facing export was a convenience re-export of ViewSwitcher that nothing consumed. The exported generateNextDocId in src/cli.ts is deleted; it was byte-identical to src/utils/id-generators.ts and had no callers, since core/backlog.ts already imported the shared helper. generateNextDecisionId stayed in cli.ts because it is still live through cli.ts and a dynamic import in core/backlog.ts. Nothing else was touched: view-switcher.ts, the onTabPress option and runUnifiedView all remain in use by the live unified view. Verified by a repo-wide grep returning zero references to every deleted symbol and a single surviving generateNextDocId definition, clean bunx tsc --noEmit and bun run check ., a successful bun run build, the full suite at 2100 pass / 6 skip / 0 fail, and a built-binary smoke test where doc create still allocated doc-1 and doc-2 sequentially and board export still rendered.
<!-- SECTION:FINAL_SUMMARY:END -->
