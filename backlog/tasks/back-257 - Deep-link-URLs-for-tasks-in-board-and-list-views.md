---
id: BACK-257
title: Deep link URLs for tasks in board and list views
status: Done
assignee:
  - '@pr755-takeover'
created_date: '2025-09-06 22:11'
updated_date: '2026-07-10 07:26'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/754'
  - 'https://github.com/MrLesk/Backlog.md/pull/755'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Background

The web app supports deep links for Documentation and Decisions using SEO‑friendly routes like `/documentation/:id/:title` and `/decisions/:id/:title` that load the item and update the URL accordingly (see `App.tsx`, `DocumentationDetail`, `DecisionDetail`, and `sanitizeUrlTitle`).

For Tasks, there is no deep link route today:
- Board (index at `/`) can open a task popup using a `?highlight=task-123` query, but the URL doesn’t reflect the task.
- All Tasks (`/tasks`) opens the task popup on click but doesn’t change the URL.
- The server doesn’t currently route `/board/*` or `/tasks/*` to the SPA entry.

Goal

Add shareable deep links for tasks that open the right view and automatically show the task popup, mirroring the docs/decisions UX but without a separate detail page.

Requested behavior

- Kanban board: clicking a task updates the URL to `/board/123/title` and opens the popup. Sharing that URL should load the board view and automatically open the popup for `task-123`.
- All tasks list: clicking a task updates the URL to `/tasks/123/title` and opens the popup. Sharing that URL should load the list view and automatically open the popup for `task-123`.
- The `title` slug is cosmetic (use `sanitizeUrlTitle`); the numeric ID is the source of truth (convert to `task-<id>` when loading).
- Closing the popup should revert the URL back to the base view (`/board` or `/tasks`) without a reload; browser Back should close the popup too.
- Maintain backwards compatibility for existing `?highlight=task-123` links.

Notes

- Server must serve `index.html` for `/board` and wildcard `/board/*`, and for `/tasks/*` like docs/decisions.
- If a direct deep link is opened before tasks are loaded, attempt loading the single task by API to ensure the modal opens reliably (similar to how `DecisionDetail` does).
- If an invalid or nonexistent ID is provided, gracefully fall back to the base view and do not open a popup.

Out of scope

- No separate per‑task detail page.
- No share button UI changes (the address bar URL is sufficient for sharing).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add client routes: /board/:id/:title and /tasks/:id/:title (both optional :title)
- [x] #2 Board: clicking a task navigates to /board/123/title and opens popup; closing returns to /board; Back closes popup
- [x] #3 All Tasks: clicking a task navigates to /tasks/123/title and opens popup; closing returns to /tasks; Back closes popup
- [x] #4 Direct visit to /board/123/title loads board and opens task-123 popup (even if tasks not yet loaded)
- [x] #5 Direct visit to /tasks/123/title loads list and opens task-123 popup (even if tasks not yet loaded)
- [x] #6 Keep supporting ?highlight=task-123 as a fallback
- [x] #7 Sanitize title with existing helper; ID is source of truth; ignore slug mismatches
- [x] #8 Server: route /board and /board/* and /tasks/* to SPA index
- [x] #9 Graceful handling for invalid IDs (no crash, no popup)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebase and retain the contributor commit while bringing the branch under BACK-257.
2. Add one browser-safe task identity and route-path implementation that preserves configured prefixes, numeric padding, dotted subtasks, cosmetic slugs, and ambiguity-safe resolution.
3. Serve board and task deep links through Bun 1.3.14 wildcard SPA routes, then drive the existing task modal from optional board/list routes with coherent direct-entry, close, Back, Forward, and legacy highlight behavior.
4. Update ordinary board/list and unified-search task opens to generate stable URLs without changing non-task views.
5. Cover server routing, identity edge cases, not-found/ambiguous behavior, StrictMode races, and history; then run focused and full automated checks plus compiled desktop browser QA.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
L2 context brief: Reviewed src/server/index.ts, src/web/App.tsx, BoardPage.tsx, Board.tsx, TaskList.tsx, TaskCard.tsx, SideNavigation.tsx, web API code, task-path and prefix-config utilities, TASK-195 history, and PR tests. Existing patterns keep the quick modal in App, use sanitizeUrlTitle for cosmetic slugs, keep highlight query links compatible, and use Bun native routes with fetch returning 404 for unmatched paths. Reuse candidates are the App modal state, sanitizeUrlTitle, prefix utilities, and the task API. Main risks are duplicate or zero-padded identity ambiguity, custom prefixes and dotted IDs, stale async opens under StrictMode, losing filtered view history, and serving SPA HTML too broadly. Official Bun docs and a pinned 1.3.14 probe confirm exact > parameter > wildcard precedence; /tasks/* and /board/* are the correct fallback companions to exact base routes, while fetch remains the unmatched 404.

Pinned Bun 1.3.14 production behavior: direct HTMLBundle routes accept POST, PUT, and OPTIONS across existing tasks, documentation, and decisions namespaces. Bun has no documented or type-safe GET/HEAD-only HTMLBundle method-map form; the runtime-only cast is intentionally not used. This PR keeps the documented exact-base plus wildcard SPA pattern and verifies GET, HEAD, and API isolation. Method hardening is a separate cross-SPA or upstream Bun concern.

Final implementation: canonicalized the browser root to /board; added optional board/list task routes backed by the existing modal; preserved cosmetic slug mismatches, filters, Back/Forward/close history, unified search, and legacy highlight links. Shared task identity resolution now supports configured prefixes, padded and dotted IDs, and fails closed on local, cross-branch, or canonical duplicate ambiguity instead of opening an arbitrary task. Added keyboard-openable task rows/cards plus modal focus entry, trap, restoration, and focused route errors. Fixed routed archive history so it closes exactly once. Validation: 62 focused tests passed with 230 assertions; full bun test passed 1,529 with 2 expected interactive TUI skips and 0 failures (5,305 assertions across 183 files); bunx tsc --noEmit, Biome over 319 files, git diff --check, and production build passed. Compiled-binary desktop Chrome QA at 1440x1000 covered direct/refresh routes, Back/Forward/close, keyboard and focus behavior, legacy highlight, invalid/malformed links, padded custom-prefix subtasks, and an injected duplicate-ID repair path. No unexpected console, page, request, or HTTP failures occurred in normal flows. An independent code review found no remaining actionable issues after the collision, archive-history, and root-canonicalization fixes.

CI correction: the initial GitHub Actions run showed that a HEAD request against a Bun 1.3.14 HTMLBundle wildcard can return 500 inside the all-files isolated test runner and then trigger cascading Bun socket errors. The browser GET routes and all compiled-binary smoke jobs passed. HEAD is not part of BACK-257 or Bun's documented method-specific HTMLBundle contract, so the destabilizing HEAD probe was removed; GET route coverage and API wildcard isolation remain. The exact CI-style local suite, bun test --isolate --timeout=10000, now passes 1,529 tests with 2 expected skips, 0 failures, and 5,301 assertions across 183 files. This supersedes the earlier note's HEAD and 5,305-assertion claims.

Exact-head CI follow-up: run 29075849302 independently reproduced the modal-focus assertion race on macOS (line 292), while Windows shard 2 passed after the HEAD probe removal. Spec review also found that ordinary task links stripped explicit alphabetic prefixes, so cross-prefix identities such as BACK-7 and JIRA-007 could collapse to an ambiguous numeric route. This correction pass keeps production focus behavior unchanged, synchronizes both focus assertions with the modal effect, and preserves explicit task prefixes in generated routes with composition coverage.

Final exact-tree correction: generated task links now retain the canonical explicit task ID, so same-number tasks under different prefixes remain unambiguous; numeric direct links remain supported. Modal focus coverage now waits across React's passive-effect boundary on initial open and Forward without changing production focus behavior. Sequential stress passed 100/100 focus runs, 100/100 cross-prefix runs, 270/270 full route-file runs, and 270/270 randomized-order runs across seeds 755, 754, and 257. The final CI-style suite passed 1,531 tests with 2 expected skips, 0 failures, and 5,304 assertions across 183 files. TypeScript, Biome over 319 files, production build, and git diff hygiene also passed. These final counts supersede all earlier focused and full-suite counts.

Focused changed-surface verification passed 20/20 tests with 97 assertions across task route history/focus, identity resolution, server SPA/API isolation, and URL generation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added safe, shareable task-modal routes for Board and All Tasks with reliable history, direct refresh, legacy highlight compatibility, canonical prefix-preserving URLs, padded and dotted ID support, ambiguity-safe duplicate handling, and keyboard/focus UX. Verified with the full 1,531-test suite, focused and randomized stress runs, static checks, production build, compiled desktop browser QA, and independent review.
<!-- SECTION:FINAL_SUMMARY:END -->
