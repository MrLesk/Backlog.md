---
id: BACK-257
title: Deep link URLs for tasks in board and list views
status: Done
assignee:
  - '@pr755-takeover'
created_date: '2025-09-06 22:11'
updated_date: '2026-07-10 12:22'
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
6. Resolve final review boundaries with precision-safe canonical ID matching across public paths, routed-modal cleanup on failed switches, focus containment against background shortcuts, and shared expand-and-focus behavior for collapsed search.
7. Restore safe exact legacy-ID compatibility end to end through Core, HTTP, and browser routes without weakening numeric ambiguity or URL safety.
8. Unify numeric and legacy task filename lookup on a complete canonical ID token terminated by " -", preserving exactly-one-match ambiguity safety across read, update, archive, complete, and save cleanup.
9. Keep active-branch collision state aligned with current configuration, content-store/root lifecycle, and live Git refs; cover toggle, branch removal, and branch change freshness without broad cache redesign.
10. Make config-write refreshes fail-safe across transient watcher null/partial reads, retain immediate active-branch off/on behavior, and add deterministic Windows-like race coverage without changing unrelated ViewSwitcher behavior.
11. Replace per-task full-store reloads with coalesced fingerprinted collision refreshes that preserve existing branch-difference semantics, make watcher publication retry-safe, and unref the stat fallback with deterministic correctness, concurrency, and process-lifecycle coverage.
12. Keep the last valid shared config observable while watcher candidates are incomplete or invalid; publish a validated candidate and collision-store transition coherently, with direct-watcher and real-server concurrency regressions plus exact-head verification.
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

Final-candidate CI run 29076728712 reproduced the routed-modal focus wait timeout on Ubuntu and Windows shard 1 under matrix load. The unrelated MCP task-type expectation also reproduces on main and remains out of scope. This pass will replace the focus test's fixed 50x5ms polling budget with deterministic, focus-specific synchronization while preserving initial-open and Forward focus assertions.

Final focus-race correction: matrix-like contention showed that the modal did focus, but SideNavigation's 100ms mount timer later moved focus to Search. Sidebar search now focuses synchronously only after a genuine collapsed-to-expanded action and never on initial expanded mount. The regression scopes focus to each dialog's ownerDocument and verifies mount, explicit expand, initial modal open, and Forward. Verification passed 200/200 focused runs across four simultaneous processes, 270/270 route-file runs, 270/270 randomized-order runs, 20/20 changed-surface tests with 106 assertions, and the full CI-style suite with 1,531 passes, 2 expected skips, 0 failures, and 5,313 assertions across 183 files. TypeScript, Biome over 319 files, production build, and diff hygiene passed. No timeout was widened and no MCP code changed; the independently reproduced MCP watcher/store race remains outside BACK-257.

Final code-quality review on f6d2865 found four bounded gaps: precision-safe task identity at public boundaries, stale routed modal state after failed route switches, focus containment against background shortcuts, and collapsed search click focus. This pass addresses only those findings and explicitly excludes the unrelated #753 MCP race.

Final review correction verified: one canonical decimal-string comparator now handles arbitrarily large, padded, zero, and dotted task IDs without number coercion; resolver, filesystem, CLI, and HTTP boundaries fail closed on duplicates. Real-git fixtures prove exact BACK-1 and padded BACK-001 collisions on active branch collision-shadow return 409. Failed 400/404/409 route switches clear the old modal and focus the repair alert while preserving Back. Modal capture blocks background Cmd/Ctrl+K and recovers outside Tab focus; every explicit collapsed-search expansion focuses Search. Focused changed-surface tests passed 61/61 with 239 assertions and legacy compatibility passed 127/127. The final CI-style suite passed 1,542 tests with 2 expected skips, 0 failures, and 5,388 assertions across 183 files using the unchanged 10-second timeout. TypeScript, Biome over 319 files, diff hygiene, and production build passed. Compiled Chromium at 1440x900 verified the real active-branch direct link rendered a focused repair alert with no modal, then verified normal modal initial focus, Cmd/Ctrl+K containment, outside-Tab recovery, Escape close, and collapsed Search click focus. No MCP code changed; #753 remains out of scope.

Exact-head review found that legacy nonnumeric task IDs remained rejected above the filesystem layer. This correction reopens BACK-257 to carry safe exact legacy-ID resolution through Core, HTTP, and browser routes without weakening numeric ambiguity or URL safety.

Legacy exact-ID correction verified: safe prefixed nonnumeric IDs now resolve by exact identity through the shared resolver, Core, HTTP API, ordinary browser clicks, and direct routes. Malformed and path-like inputs remain invalid, missing safe legacy IDs return not found, duplicate exact IDs fail closed, and numeric/dotted/huge canonical ambiguity remains unchanged. Core checks the uncollapsed local filesystem view before returning a cached task, while the canonical filename separator keeps TASK-PREFIXED and TASK-PREFIXED-EXTRA independent during load and save cleanup.

Final exact-tree evidence: focused compatibility matrix passed 166 tests with 493 assertions; the unchanged full bun test --isolate --timeout=10000 suite passed 1,553 tests with 2 expected interactive skips, 0 failures, and 5,425 assertions across 183 files. TypeScript, Biome over 319 files, production build, and diff hygiene passed. Delegated compiled Chrome QA at 2174x1315 verified ordinary click, lowercase direct route, independent longer-sibling route, focused missing and encoded-traversal errors with no stale modal, and no console warnings/errors or framework overlay. Separate visual observation: the unusually long TASK-PREFIXED-EXTRA ID overlaps its title in the All Tasks table; no layout change was made in this narrow identity correction.

Final code-quality gate on 72f6073 found two bounded correctness defects: numeric filename parsing can target BACK-1-EXTRA as BACK-1, and active-branch duplicate collisions remain stale after config or branch lifecycle changes. Reopened for exact-token parsing and collision-cache freshness regressions; no MCP or broad cache redesign scope.

Final gate corrections on the post-72f6073 tree:
- Task filename lookup now extracts one complete canonical filename ID token terminated by " -" and sends both numeric and legacy candidates through the same taskIdsEqual matcher with exactly-one-match ambiguity handling. BACK-1 no longer reads, updates, archives, completes, or deletes BACK-1-EXTRA; mixed-case padded/dotted numeric identities still match and canonical duplicates still fail closed.
- Active-branch collision checks now read current config, ContentStore refreshes before branch-sensitive single-task reads and after config writes/watch events, and cached branch entries clear with content-store/root lifecycle. Real-Git tests cover 409 -> config off 200 -> on 409, branch deletion, and out-of-worktree branch content changes without relying on the main task watcher.
- Focused verification: 149 tests passed, 0 failed, 416 assertions across task-path, FileSystem, Core, and server regressions.
- Full verification: bun test --isolate --timeout=10000 passed 1,563 tests with 2 expected interactive skips, 0 failures, and 5,464 assertions across 183 files. bunx tsc --noEmit, Biome over 319 files, production build, and git diff --check passed.
- Rebuilt compiled desktop Chrome QA at the normal desktop viewport verified: BACK-2 returned a focused not-found alert while BACK-2-EXTRA remained unopened; BACK-2-EXTRA opened exactly; a real active-branch BACK-1 duplicate returned the repair alert; after PUT /api/config set checkActiveBranches=false, the same route opened the local BACK-1 modal and closed cleanly to /tasks. No console warnings/errors or framework overlay appeared. The previously documented long-ID table overlap remains a separate visual observation and was not changed.

Final Windows config-write race correction: shared one atomic-replacement-safe config watcher across server and ContentStore, publishes only stable parser-valid config after transient null/partial reads, preserves sparse supported config, serializes and drains server refresh work, removes the redundant config-PUT refresh, and refreshes branch-sensitive list reads against the current flag. Deterministic null-to-valid, sparse-config, prefix-only, off/on list, and shutdown regressions were added without widening the 10-second timeout or touching ViewSwitcher. Stress evidence: watcher 150/150 and server toggle 30/30. Exact final tree: bun test --isolate --timeout=10000 passed 1,566 tests with 2 expected interactive skips, 0 failures, and 5,491 assertions across 184 files; TypeScript, Biome over 320 files, production build, and diff hygiene passed. Compiled real-Git desktop Chrome QA verified collision repair alert/no modal, immediate config false/true readback, branch-only list removal/restoration, local modal/close routing while disabled, restored 409 ambiguity, and zero console warnings/errors.

Final per-task read correction: GET now compares a coalesced one-process config/ref/current-branch fingerprint and refreshes the existing ContentStore only when that snapshot changes. Branch collision state carries pinned tree blob IDs, collapses byte-identical inherited tasks, fails closed on changed or duplicate identities, hashes live files through Git clean filters, retries when refs/config move during indexing, returns current-worktree content before store fallback, and includes complete configured-prefix legacy IDs for local and remote branches. Config publication now advances its marker only after callback success, serializes retries, suppresses post-success duplicates, and unreferences the stat fallback while retaining cleanup. Objective evidence: 43 focused tests passed; final bun test --isolate --timeout=10000 passed 1,578 with 2 expected skips, 0 failures, and 5,544 assertions across 184 files; TypeScript, Biome over 320 files, production build, and diff hygiene passed. Exact-tree compiled Chrome QA verified All Tasks BACK-532 and Board BACK-522 click-to-canonical-route plus hard-refresh dialog restoration at 2174x1315 with nonblank DOM, no framework overlay, and no console warnings/errors. Real-repository steady GET sampling was 61-72ms across 12 sequential reads; deterministic instrumentation proves 0 full reloads for unchanged refs and exactly 1 coalesced reload after a changed ref. Independent final re-review approved with no release blockers.

Exact-head CI portability correction: run 29089318037 passed Linux/macOS/Windows compiled smoke, both Linux/macOS lint-unit jobs, and Windows shard 1 before Windows shard 3 exposed a test-fixture-only separator error: relative() supplied backslashes to git show for an in-tree path. The fixture now normalizes the Git tree path to forward slashes; production code is unchanged. The complete server task-route file passed 19/19 with 153 assertions, including the corrected live-worktree test; TypeScript, Biome over 320 files, and diff hygiene passed. The replacement exact-head run is the authoritative CI result.

Final code gate reopened the task for a P1 config fail-open: the watcher currently invalidates and populates the shared cache before validating a stable candidate, allowing an invalid partial config to disable active-branch collision checks without publication. This pass will preserve the last valid observable config until a candidate is validated and will verify callback retry consistency.

Final config fail-closed release gate: the watcher now parses stable candidate bytes without mutating shared state, validates explicitly present collision-sensitive booleans, active-branch days, task prefix, and root backlog pointer, then publishes config plus root resolution from the same accepted snapshot. Invalid or incomplete candidates preserve the last valid cache, task root, and active-branch 409 behavior. Callback publication retries independently past the read budget and suppresses duplicates after success. Deterministic focused evidence passed 32/32 tests with 671 assertions, including concurrent API/Core/task reads, root custom-directory TOCTOU and recovery, malformed safety fields, sparse valid folder config, and ten callback rejections before success. Independent re-review approved the exact diff fingerprint with no remaining P1/P2. The authoritative fresh full suite passed 1,580 tests with 2 expected skips, 0 failures, and 6,020 assertions across 184 files using the unchanged 10-second timeout; TypeScript, Biome over 320 files, diff hygiene, and production build passed. Delegated freshly compiled desktop Chrome QA at 1440x900 passed Board BACK-522 and All Tasks BACK-532 canonical click plus hard-refresh restoration with exactly one dialog, nonblank DOM, no framework overlay, empty warning/error console, config GET 200, and the expected BACK-257 collision 409. An earlier in-progress full run was terminated and discarded after later review findings changed the tree; only the fresh immutable-tree run is counted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the BACK-257 deep-link takeover and final release hardening. Stable invalid or partial config writes can no longer replace the last valid shared config, switch root/task resolution, or disable duplicate-ID collision protection; validated candidates publish cache and root resolution from one snapshot, and callback retries remain durable. Verified by independent approval, 32 focused tests/671 assertions, the fresh full suite at 1,580 passes with 2 expected skips and 0 failures, clean TypeScript/Biome/build/diff gates, and compiled desktop Board/All Tasks click-and-refresh QA with clean console and expected collision handling.
<!-- SECTION:FINAL_SUMMARY:END -->
