---
id: BACK-654
title: Polish the cross-branch indexing loading indicator in the web UI
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 11:55'
updated_date: '2026-08-30 19:40'
labels:
  - web
  - enhancement
dependencies: []
ordinal: 286000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While the web UI indexes other local branches it shows a spinner with the text "Indexing 35 other local branches...". The maintainer wants this indicator improved as part of the UI delight effort. The implementer proposes the concrete design in the plan for review; it must fit the existing web design language, stay unobtrusive, and never block interaction with already-loaded content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The cross-branch indexing state is shown with a polished, design-consistent indicator instead of the current spinner-plus-sentence
- [x] #2 Already-loaded content stays fully interactive while indexing runs
- [x] #3 The indicator disappears cleanly when indexing completes, including the fast-completion case without flicker
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Design proposal (for maintainer review before code)

Current treatment being replaced: the WebSocket browser-loading messages ("Indexing 35 other local branches...") render as a raw sentence next to the board spinner (Board.tsx loading block) and three more times in SideNavigation via LoadingPhase. App.tsx also sets isLoading(true) on any mid-session loading event, which flips already-loaded content back to skeletons - that is the AC #2 violation.

Proposed design: a single shell-level "branch indexing" indicator in the top header (Navigation.tsx), two coordinated parts rendered by one new component, BranchIndexingIndicator:

1. Hairline sweep bar: absolutely positioned 2px bar (h-0.5, inset-x-0 bottom-0) sitting exactly on the header's existing bottom border, so the border "comes alive" while indexing. Motion: a ~40%-width gradient segment (from-transparent via-blue-500 to-transparent; dark: via-blue-400) sweeping left-to-right, ~1.4s infinite ease-in-out, defined next to the existing slide-in-down keyframes in styles/source.css. pointer-events-none, no layout shift, hidden under motion-reduce.

2. Status chip in the header's right cluster (before ThemeToggle): compact rounded-full pill reusing the active-nav accent (bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400), text-xs font-medium, containing a 12px spinner ring reusing the board spinner style (border-2, border-t current accent, animate-spin) and the single label "Indexing branches" - no sentence, no count, per the UI-copy rule. The full server message is preserved as title tooltip and sr-only text; the chip is role="status" so screen readers hear the real progress line.

Motion/flicker rules (AC #3): indicator mounts only after the loading message has persisted ~250ms (fast completions never flash anything); entry is a 200ms fade+2px rise (matching the app's duration-200 conventions); on completion it fades out 200ms and unmounts. Delays are props so jsdom tests can use short values.

Reused design elements: header nav bar placement, active-NavLink blue accent pill, board spinner ring style, animate-pulse skeletons (kept in sidebar), duration-200 transitions, source.css keyframe pattern.

Implementation steps:
1. New src/web/components/BranchIndexingIndicator.tsx with the delayed-appear/fade-out state machine; sweep keyframe added to styles/source.css.
2. Navigation.tsx gains relative positioning and an optional loadingMessage prop; Layout.tsx passes it through.
3. App.tsx: mid-session WS "loading" events no longer set isLoading(true) once data has loaded (hasLoadedDataRef) - loaded content stays mounted and interactive while the indicator runs (AC #2). Initial load keeps today's behavior.
4. Remove the raw sentence everywhere: SideNavigation drops the loadingMessage prop and LoadingPhase renders only its skeleton pulse; App stops passing loadingMessage to BoardPage (Board.tsx untouched - its optional prop simply stays unset, avoiding overlap with PRs #945/#960).
5. Tests: new jsdom test (pattern of web-task-details-modal-keyboard-shortcuts.test.tsx) covering: no render before the appear delay, visible chip+bar with role=status after it, fast completion never appears, clean fade-out unmount on completion; update web-side-navigation-loading.test.tsx for the removed sentence.
6. Verify: bunx tsc --noEmit, bun run check ., bun test; manual light+dark visual pass in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-654-indexing-indicator: new BranchIndexingIndicator (header chip reusing the active-nav blue pill + 12px spinner ring, hairline indexing-sweep bar on the header's bottom border, 250ms delayed appear, 200ms fade-out, motion-reduce fallbacks). Navigation/Layout wire the WS loading message to it; SideNavigation's LoadingPhase is now a pure skeleton and App no longer passes the raw sentence to the board. App.tsx gates the blocking skeleton on first-load only (hasLoadedDataRef) so loaded content stays mounted and interactive during later indexing. Verified live in the browser against this repo's 119 local branches: dark-theme chip visible during cold indexing; warm restart completes fast with no flash or residue (light theme). tsc, biome, and the new jsdom tests (4) pass; full suite running.

Full-suite triage: 3 tui-emoji-width failures were the worktree's stale node_modules (neo-neo-bblessed 1.0.9 vs locked 1.0.10; bun i fixed, bun.lock unchanged). The remaining 3 were web-task-detail-deeplink reconciliation tests observing the removed raw phase sentence; they now observe the indicator (its sr-only text carries the full server message) by waiting out the 250ms appear / 200ms exit windows, with renderApp's afterInitialStatus hook moved outside act so callbacks can observe flushed DOM. All 29 deeplink tests pass; final full suite running.

PR #971 review round: both Codex threads were real. (1) App.tsx now clears loadError on every WS loading frame (only setIsLoading stays first-load gated), so a passive client that had cached content plus a stale terminal error shows its content again when another browser's retry starts indexing; regression test added (clears a stale terminal error and shows cached content when indexing restarts). (2) The chip label is hidden below the sm breakpoint (icon-only pill, sr-only message intact) so narrow headers do not overflow; verified at 375px that the remaining header crowding pre-exists with the chip unmounted. Scoped tests 38 pass, tsc and biome clean. Head 83dab5ba.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the spinner-plus-sentence cross-branch indexing treatment with a shell-level indicator in the top header: a compact status chip (active-nav blue pill tokens, 12px spinner ring, label 'Indexing branches', full server progress message as tooltip and sr-only text on role=status) plus a 2px gradient sweep along the header's bottom border (motion-reduce aware). The indicator mounts only after the indexing state persists 250ms and fades out 200ms on completion, so fast completions never flash (verified live: warm-cache restart showed no flash or residue; cold start against ~120 local branches showed the chip in dark theme). App.tsx now gates the blocking skeleton on first load only (hasLoadedDataRef), so already-loaded content stays mounted and interactive during mid-session indexing, and the raw sentence was removed from the sidebar (LoadingPhase is a pure skeleton) and the board (App no longer passes loadingMessage; Board.tsx untouched to avoid PR #945/#960 overlap). Verified with bunx tsc --noEmit, bun run check ., and the full bun test suite (2571 pass / 0 fail) including new jsdom coverage in web-branch-indexing-indicator.test.tsx for delayed appearance, announced message, fast-completion no-flash, clean fade-out unmount, and message replacement. PR #971; maintainer visual pass on the final look (esp. light-theme chip and whether the sweep bar stays) still pending.
<!-- SECTION:FINAL_SUMMARY:END -->
