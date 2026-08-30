---
id: BACK-655
title: Open task details in place from sidebar dependency chips
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 12:21'
updated_date: '2026-08-30 15:41'
labels:
  - web
  - bug
dependencies: []
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task links in the web sidebar dependency chips (DependencyInput.tsx:132) hardcode `/tasks/<id>`, so clicking one while reading the Kanban Board switches to the All Tasks page and then opens the detail. In-app task links must open the task detail without changing the page the reader is on, deriving the href from the current base path the way the board click path and the task-detail dependency-graph links (BACK-548) already do. External deep links to `/tasks/<id>` keep working.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a dependency chip from the board opens the task detail while staying on the board
- [x] #2 Clicking one from All Tasks behaves as today
- [x] #3 External deep links to /tasks/<id> still resolve
- [x] #4 A test pins the stay-on-page behavior for the board path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the established in-place navigation pattern: App.tsx handleEditTask (and BACK-548 graph links) derive the task-detail base path from the current location ('/board' vs '/tasks'). PR #960's useTaskHref hook is not on main yet, so implement the same derivation locally in DependencyInput via useLocation, shaped so #960's hook can absorb it trivially later.
2. In DependencyInput.tsx replace the hardcoded /tasks/<id> chip href with <base>/<id> where base is '/board' when location.pathname starts with /board, otherwise '/tasks' (canonical fallback keeps today's behavior on other pages and for external deep links; routes are untouched).
3. Extend src/test/web-dependency-input-links.test.tsx: pin that a chip rendered under /board links to /board/<id> (stay-on-board) and under /tasks keeps /tasks/<id>; existing tests pin the default fallback.
4. Verify: bunx tsc --noEmit, bun run check ., bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the hardcoded /tasks/<id> chip href in DependencyInput.tsx with a location-derived base path: '/board' when the reader is on the board, otherwise the canonical '/tasks' (fallback keeps today's behavior on other pages and leaves external /tasks/<id> deep links untouched). This mirrors App.tsx handleEditTask's base-path derivation, the same pattern the BACK-548 graph/parent/subtask navigation uses.

Consolidation note: PR #960 (unmerged) introduces a useTaskHref hook with this exact derivation for graph links. That hook is not on main yet, so this fix implements the logic locally (one useLocation + one ternary inside DependencyInput); when #960 lands, the chip href can trivially switch to useTaskHref by deleting the local derivation. Nothing was cherry-picked from the #960 branch and TaskDetailsModal was not touched.

Tests: extended src/test/web-dependency-input-links.test.tsx - chips rendered under /board link within /board (stay-on-board, AC #4), chips under /tasks keep /tasks hrefs, and the existing default-route tests pin the /tasks fallback.

Refinement: the first cut called useLocation at DependencyInput's top level, which broke 53 existing TaskDetailsModal tests that render without a Router (previously safe because Link only mounts when a chip resolves). Moved the derivation into a local TaskChipLink subcomponent inside DependencyInput.tsx, so router context is only required exactly where a link renders - same contract as before. All previously failing web suites pass again; the 3 tui-emoji-width failures in the local run reproduce on a pristine origin/main worktree (environment-related, pre-existing, unrelated to this change).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dependency chips in the task-detail sidebar now open tasks in place: DependencyInput's chip link derives its base path from the current location ('/board' when reading from the board, canonical '/tasks' everywhere else) via a local TaskChipLink subcomponent that mirrors App.tsx handleEditTask's derivation - the same pattern as the BACK-548 parent/subtask navigation. PR #960's unmerged useTaskHref hook can absorb the derivation trivially once it lands; nothing was cherry-picked and TaskDetailsModal was untouched. Verified: new tests in web-dependency-input-links.test.tsx pin /board chips staying on /board (AC 1, 4) and /tasks chips unchanged (AC 2); routes untouched and default-route tests pin the /tasks fallback so external deep links resolve (AC 3); bunx tsc --noEmit, bun run check ., and full bun test green (2566 pass; only 3 tui-emoji-width failures that reproduce identically on pristine origin/main).
<!-- SECTION:FINAL_SUMMARY:END -->
