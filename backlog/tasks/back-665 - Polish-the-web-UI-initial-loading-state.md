---
id: BACK-665
title: Polish the web UI initial loading state
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-30 21:48'
updated_date: '2026-08-30 22:20'
labels:
  - web
  - enhancement
dependencies: []
ordinal: 297000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The pre-board loading state still shows a large plain square/spinner (maintainer: "the old ugly square"), and the dev-served bundle renders a giant unconstrained loading SVG (~13k px) before the board mounts. Replace the initial loading state with a small, design-consistent indicator matching the polish standard set by the indexing chip (BACK-654), constrain or fix the oversized SVG, and keep the first-load skeleton behavior from BACK-654 (loading shell only before first successful load).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The initial load shows a compact, design-consistent indicator in light and dark themes; no oversized square or unconstrained SVG at any point
- [x] #2 Post-first-load refreshes still never show the blocking shell
- [ ] #3 jsdom tests cover the loading state; visual pass by the maintainer
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root cause: src/web/styles/source.css deliberately excludes rounded-full from the compiled Tailwind CSS (@source not inline("{rounded-full}"), since TASK-179; the project utility is rounded-circle). The Board first-load spinner (Board.tsx:832) uses the dead rounded-full class, so it renders as a spinning bordered SQUARE inside a plain gray box - the 'old ugly square'. No inline SVG in the loading path is unconstrained (all icons carry w-*/h-* classes); the previously reported ~13k px 'giant SVG' matches the unstyled shell during a dev pre-CSS window (with stylesheets absent the stacked board columns measure ~12.7k px), not a shipped oversized SVG. Fix = stop relying on the dead class and polish the two pre-first-load surfaces.
2. Design - app pre-init screen (App.tsx isInitialized===null): replace the 'Loading...' text with the shared LoadingSpinner ring (h-6 w-6, border-2, rounded-circle, gray track border-gray-300/dark:border-gray-600 with blue arc border-t-blue-600/dark:border-t-blue-400), centered on bg-gray-100 dark:bg-gray-900, no visible copy (role=status + sr-only label). Add motion-reduce:animate-none to LoadingSpinner (shared element reused; already rounded-circle).
3. Design - board first-load state (Board.tsx first-load branch): extract into a small BoardLoadingSkeleton component that mirrors the real board geometry so content replaces it with no layout jump: 3 ghost columns with the exact real column chrome (flex flex-row flex-nowrap gap-4 w-full; each flex-1 min-w-[16rem] > rounded-lg p-4 min-h-96 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700), each containing a header line + 3 card-shaped placeholders (h-16/h-20 rounded-md bg-gray-100 dark:bg-gray-700/50 animate-pulse motion-reduce:animate-none), all aria-hidden. Centered over the ghosts (absolute inset-x-0 top area, pointer-events-none): a compact status chip reusing the BranchIndexingIndicator chip design verbatim - rounded-circle pill, bg-blue-50 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400, text-xs font-medium, h-3 w-3 border-2 spin ring (border-blue-200 border-t-blue-600, motion-reduce:animate-none, dark variants) - showing the existing loadingMessage when present, otherwise ring-only with sr-only 'Loading tasks'. role=status + aria-label='Loading tasks' preserved. No new copy.
4. Behavior preserved: App.tsx hasLoadedDataRef gating from BACK-654 untouched - blocking skeleton only before the first successful load; refreshes keep rendering live data.
5. Tests: new jsdom test for BoardLoadingSkeleton (role=status + aria-label, chip message rendering, no rounded-full class anywhere, rounded-circle ring + motion-reduce classes present, ghost columns aria-hidden) modeled on web-branch-indexing-indicator.test.tsx.
6. Out of scope, flagged for follow-up: other dead rounded-full usages (MilestoneTaskRow, ProjectBadge, Board lane badges/progress, TaskColumn drop indicators, MilestonesPage) silently render square corners today.
7. Verify: bunx tsc --noEmit, bun run check ., bun test; light+dark screenshots for the maintainer's visual pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause found: rounded-full is deliberately excluded from the compiled Tailwind CSS (@source not inline in src/web/styles/source.css since TASK-179; the project utility is rounded-circle), so the Board first-load spinner rendered as a spinning bordered square inside a plain gray box - the 'old ugly square'. No unconstrained inline SVG exists in the loading path; the previously reported ~13k px measurement matches the unstyled shell when stylesheets are absent (stacked board columns measure ~12.7k px without CSS), not a shipped SVG. Implemented: new BoardLoadingSkeleton (ghost columns with real column chrome + centered chip-style spinner ring reusing the BranchIndexingIndicator design), App pre-init screen now uses the shared LoadingSpinner ring instead of 'Loading...' text, LoadingSpinner gained motion-reduce:animate-none. Verified in browser light+dark; jsdom tests added (web-board-loading-skeleton.test.tsx, 3 pass). bunx tsc --noEmit clean, bun run check clean, full bun test: only pre-existing tui-emoji-width failures (also fail on clean origin/main).

AC2 verification probe: exercising the live tasks-updated broadcast.

AC1 evidence: browser verification on the dev server, light and dark - skeleton shows ghost columns matching real board geometry plus a compact circular ring (rounded-circle; the dead rounded-full class is gone from the loading path); loaded columns replace ghosts in place. AC2 evidence: live probe - after first load, two tasks-updated WebSocket broadcasts (triggered by CLI edits) refreshed the app with no [aria-label='Loading tasks'] element ever mounting and the board staying visible. AC3: jsdom tests pass; maintainer visual pass pending, so AC3 stays unchecked and the task stays In Progress.

Review fix (Codex, PR #977): BoardLoadingSkeleton now takes columnCount and Board passes statuses.length once fetchStatuses has populated, so boards with two or four-plus statuses mount without a column-count/width jump; 3 stays as the pre-config fallback. jsdom tests extended for 5, 2, and 0 (fallback) statuses - 5 pass. Pushed fast-forward as bd1be48a.
<!-- SECTION:NOTES:END -->
