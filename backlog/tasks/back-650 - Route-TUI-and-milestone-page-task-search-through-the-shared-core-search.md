---
id: BACK-650
title: Route TUI and milestone-page task search through the shared core search
status: Done
assignee:
  - '@claude'
created_date: '2026-08-29 21:04'
updated_date: '2026-08-29 23:00'
labels:
  - tui
  - web
dependencies:
  - BACK-649
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stage 2 of the search unification, after the config single-sourcing task: the TUI task viewer uses both createTaskSearchIndex and SearchService with a hand-rolled duplicate of milestone/labelMatch/ready post-filtering (~60 lines) in its SearchService branch; MilestonesPage runs a third private in-browser Fuse over id/title with its own weights. Collapse the TUI fallback branch onto the shared index and route MilestonesPage through the shared config or the /api/search endpoint, deleting the private implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The TUI task viewer's SearchService fallback branch and its hand-rolled post-filters are collapsed onto the shared search path
- [x] #2 MilestonesPage no longer ships a private Fuse configuration
- [x] #3 Search behavior in TUI and milestones view matches the other surfaces for the same query
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Branch tasks/back-650-shared-search-routing off origin/main (contains BACK-649's src/utils/task-search.ts).
2. TUI (src/ui/task-viewer-with-search.ts): always build taskSearchIndex = createTaskSearchIndex(allTasks) after the corpus loads, in both the options.tasks branch and the ContentStore branch. Delete the searchService field, its applyFilters branch, and the hand-rolled milestone / labelMatch=all / ready post-filters; applyFilters keeps a single applyTaskFilters(allTasks, {...}, taskSearchIndex) call. Keep the ContentStore acquisition and dispose so watcher lifecycle is unchanged. Drop now-unconditional 'if (taskSearchIndex)' rebuild guards and unused imports.
3. Web (src/web/components/MilestonesPage.tsx): delete the private Fuse instance, its id/title weights, and the MilestoneSearchEntry type; run the bucket task corpus through the shared createTaskSearchIndex so the milestone view uses the same keys, weights, and threshold as every other surface. Client-side rather than /api/search: the page filters buckets already built from its tasks prop, so an API round trip would only be reconciled back to the same corpus by id, and the search stays synchronous with no debounce or loading state.
4. Tests: pin cross-surface parity - a TUI-corpus query and a milestone-page query return the same task set the shared index returns for the same query.
5. Verify bunx tsc --noEmit, bun run check ., bun test; open the PR without merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TUI (src/ui/task-viewer-with-search.ts): the viewer now builds one createTaskSearchIndex over allTasks whatever way the corpus arrived, and applyFilters is a single applyTaskFilters call. Deleted the SearchService branch and the hand-rolled milestone / labelMatch=all / readiness post-filters, plus the now-dead hasActiveFilters short-circuit (an unset filter contributes no check, so the shared predicate already covers the no-filter case). Two latent inconsistencies go with them: the SearchService branch searched the whole ContentStore while the unfiltered list rendered the prefix-filtered allTasks snapshot, and it never re-indexed after an in-session edit, complete, or archive because the rebuild was guarded on the index the branch did not use.

MilestonesPage (src/web/components/MilestonesPage.tsx): private Fuse (title 0.55 / id 0.45) and MilestoneSearchEntry deleted; the bucket corpus runs through the shared index instead. Chose the shared index over /api/search because the page filters buckets already built from its tasks prop, so an API round trip would only be reconciled back to the same corpus by id, and the filter stays synchronous with no debounce or loading state.

User-visible change: the milestone page loses its exact-id-wins short-circuit, so a full-id query now returns the fuzzy id neighbours too (searching task-404 in a four-task corpus also matches task-101/202/303). That is exactly what the TUI and the sidebar already do with the shared config; the sidebar only hides it by ranking and slicing to 5, while this page uses the result as a set. Milestone search also widens from id+title to the full shared corpus (description, acceptance criteria, plan, notes, comments, labels, assignees), so the placeholder changed from 'Search by task ID or title' to 'Search tasks'.

Validation: bunx tsc --noEmit clean; bun run check . clean; bun run test 2567 pass / 0 fail. Note the worktree needed bun install first - the shared node_modules had neo-neo-bblessed 1.0.9 while main locks 1.0.10, which failed three unrelated tui-emoji-width tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Routed the TUI task viewer and the web milestones page through the shared core task search. The viewer keeps one createTaskSearchIndex over its loaded corpus and filters with a single applyTaskFilters call, deleting the SearchService branch and its duplicate milestone / labelMatch / readiness post-filters; MilestonesPage drops its private Fuse config for the shared index. Verified with bunx tsc --noEmit, bun run check ., and bun run test (2567 pass, 0 fail), including new tests pinning that the milestone page renders exactly the shared index's matches for a query and that milestone, no-milestone, and readiness filters mean the same thing with and without a query.
<!-- SECTION:FINAL_SUMMARY:END -->
