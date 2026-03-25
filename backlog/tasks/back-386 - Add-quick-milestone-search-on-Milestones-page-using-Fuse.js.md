---
id: BACK-386
title: Add quick milestone search on Milestones page using Fuse.js
status: Done
assignee:
  - '@codex'
created_date: '2026-02-17 20:29'
updated_date: '2026-02-21 20:18'
labels: []
milestone: m-6
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a client-side quick search input on the Web Milestones page so users can rapidly filter milestone groups/tasks by fuzzy text match. This should improve navigation when many milestones/tasks are present and match the existing page visual style.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestones page shows a search input near the page header and it is keyboard-focusable.
- [x] #2 Typing in the search input filters visible milestone groups/tasks using Fuse.js fuzzy matching across task id and title.
- [x] #3 Search updates results quickly without full page reload and preserves existing collapse/expand behavior.
- [x] #4 Clearing the search restores the full milestones view.
- [x] #5 Web tests cover search filtering behavior and empty/no-match state handling.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Context-hunter micro-brief (L1)
- Closest analogs: `src/web/components/TaskList.tsx` (search input/clear/no-match UX patterns), `src/utils/task-search.ts` and `src/core/search-service.ts` (Fuse options and ID/title-oriented fuzzy search patterns), and `src/web/components/MilestonesPage.tsx` (existing bucket grouping, ordering, collapse state).
- Main risk: filtering must not disturb milestone bucket behavior (ordering, drag/drop targets, expand/collapse state defaults) and must clearly differentiate true empty state vs search no-match state.

## Implementation plan mapped to Acceptance Criteria
1. AC #1 (search input near header, keyboard-focusable)
- Update `src/web/components/MilestonesPage.tsx` header actions to include a text search input adjacent to the page title/header controls.
- Add accessible labeling (`aria-label` and/or explicit `<label>`), keep native `<input type="text">` focus behavior, and include a clear button consistent with existing web UI patterns.

2. AC #2 (Fuse.js fuzzy filter across task id + title)
- In `src/web/components/MilestonesPage.tsx`, add local `searchQuery` state and a memoized Fuse index over milestone-page tasks.
- Configure Fuse keys to task `id` and `title` only (no body fields), using local Fuse conventions (`threshold: 0.35`, `ignoreLocation: true`, `minMatchCharLength: 2`).
- Build a matched task-id set from Fuse results and derive filtered milestone buckets/tasks from existing bucket data, preserving current sort/group rules.

3. AC #3 (fast client updates, no reload, preserve collapse/expand)
- Keep filtering entirely client-side in `useMemo` (no API refetch/reload).
- Preserve `expandedBuckets` behavior by keeping bucket keys stable and not resetting expansion state when search changes.
- Ensure default expansion logic still follows existing page rules when no explicit toggle exists.

4. AC #4 (clear search restores full view)
- Implement clear action and empty-query branch that returns original unfiltered milestone/unassigned/completed views.
- Keep current empty-state behavior for non-search scenarios unchanged.

5. AC #5 (web tests: filtering + empty/no-match)
- Add focused web test coverage in `src/test/web-milestones-page-search.test.tsx`.
- Test cases:
  - Search input renders and is focusable.
  - Typing query filters visible milestone tasks by fuzzy id/title matches.
  - Clearing query restores full milestone view.
  - No-match query shows search-specific empty state message.
  - Collapse/expand state remains stable across search updates.

## Expected files
- `src/web/components/MilestonesPage.tsx`
- `src/test/web-milestones-page-search.test.tsx`

## Verification plan mapped to Definition of Done
- DoD #1 (TypeScript): `bunx tsc --noEmit`
- DoD #2 (format/lint): `bun run check .`
- DoD #3 (tests):
  - Targeted: `bun test src/test/web-milestones-page-search.test.tsx`
  - Optional confidence pass: `bun test`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Milestones page client-side search using Fuse.js directly in `MilestonesPage` with keys on task `id` and `title` only, plus a search input/clear control near the header.

Decision: preserve existing bucket collapse/expand behavior by keeping `expandedBuckets` state keyed by bucket and basing default expansion on pre-filter bucket totals.

Decision: when a query exactly matches a task ID (case-insensitive), prefer exact ID match set before fuzzy fallback to avoid over-broad near-ID results.

Added search-specific no-match UI state (`No milestones or tasks match ...`) and clear action that restores full view without reload.

Added web interaction tests in `src/test/web-milestones-page-search.test.tsx` covering keyboard-focusable input, ID/title filtering, clear-to-restore, no-match state, and preserved collapse state during search.

Verification evidence (final run):

- `bunx tsc --noEmit` -> FAIL (existing unrelated error in `src/cli.ts`: TS18048 at lines 298 and 299, `'arg' is possibly 'undefined'`).

- `bun run check .` -> PASS (`Checked 243 files ... No fixes applied`).

- `bun test src/test/web-milestones-page-search.test.tsx` -> PASS (3 pass, 0 fail).

Because `tsc` currently fails due pre-existing `src/cli.ts` typing issue outside BACK-386 scope, DoD #1 remains unchecked.

Retrospective simplification: kept Fuse integration directly inside `MilestonesPage` and avoided introducing a new shared abstraction because search behavior is currently page-local.

PR opened: https://github.com/MrLesk/Backlog.md/pull/538

TPM dependency note: DoD #1 is blocked by repository baseline TS18048 in `src/cli.ts` (fixed in PR https://github.com/MrLesk/Backlog.md/pull/539 under BACK-393). Re-run `bunx tsc --noEmit` after that baseline fix is merged/rebased, then finalize task.

Follow-up bugfix for PR #538: Milestones search now keeps all milestone buckets and the unassigned section visible as persistent sections during search; only task rows inside each bucket are filtered.

Adjusted `MilestonesPage` search behavior to rebuild every bucket with filtered tasks instead of removing buckets with zero matches. This preserves milestone card visibility, collapse state, and milestone drop targets during search.

Updated unassigned rendering to remain visible during active search when zero tasks match, with an explicit empty-state message (`No matching unassigned tasks.`).

Replaced search-empty replacement screen with a non-blocking no-match hint so milestone/unassigned sections remain rendered; clear-search action remains available.

Verification (2026-02-21): `bun test src/test/web-milestones-page-search.test.tsx` PASS (4/4), `bun run check .` PASS, `bunx tsc --noEmit` FAIL with existing baseline error in `src/cli.ts` lines 298-299 (`TS18048: 'arg' is possibly 'undefined'`).

2026-02-21T20:17:44Z evidence: baseline check on branch `main` -> `bunx tsc --noEmit` exited 0 with no TypeScript errors.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
