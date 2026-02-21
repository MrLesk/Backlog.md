---
id: BACK-387
title: Hide Done tasks from Unassigned group on Milestones page
status: Done
assignee:
  - '@codex'
created_date: '2026-02-17 20:31'
updated_date: '2026-02-21 20:18'
labels: []
milestone: m-6
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Web Milestones page so the Unassigned tasks group does not display tasks with Done status. This should reduce noise and keep unassigned work focused on active/pending items while preserving existing milestone grouping behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unassigned tasks group on the Milestones page excludes tasks whose status is Done.
- [x] #2 Unassigned task count reflects only non-Done tasks after filtering.
- [x] #3 Milestone-assigned groups keep their current behavior and are not regressed by this change.
- [x] #4 If all unassigned tasks are Done, the Unassigned group shows an appropriate empty state instead of listing Done tasks.
- [x] #5 Web tests cover filtering and count behavior for Done vs non-Done unassigned tasks.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Context-Hunter Micro-Brief (L1)
- **Complexity:** L1 (moderate, behavior change in one bounded web UI area).
- **Closest analog:** `src/web/components/MilestonesPage.tsx` currently sorts unassigned tasks with Done tasks last, and `src/core/milestones.ts` provides shared milestone buckets consumed by both web and CLI.
- **Main risk/ambiguity:** Changing shared bucket generation could regress milestone-assigned groups and CLI milestone summaries. Keep filtering scoped to the Unassigned section render path.

## Implementation Plan
1. **Filter Unassigned display data only (no shared bucket behavior changes)**
- File: `src/web/components/MilestonesPage.tsx`
- Build a filtered unassigned task list that excludes Done/Complete statuses before rendering rows.
- Keep existing milestone card rendering and shared bucket construction untouched.
- **Covers AC #1 and AC #3.**

2. **Update Unassigned count/pagination to use filtered tasks**
- File: `src/web/components/MilestonesPage.tsx`
- Use filtered non-Done unassigned total for the header count and show-more/show-less behavior.
- Ensure displayed count matches rendered rows after filtering.
- **Covers AC #2.**

3. **Add explicit empty state for all-Done unassigned scenarios**
- File: `src/web/components/MilestonesPage.tsx`
- When an unassigned bucket exists but filtered non-Done list is empty, render an empty-state message instead of task rows.
- Do not render Done rows in this state.
- **Covers AC #4.**

4. **Add web tests for filtering + count + non-regression**
- File (new): `src/test/web-milestones-page-unassigned-filter.test.tsx`
- Test case A: Mixed unassigned Done + non-Done tasks => Done unassigned tasks are not rendered; count reflects only non-Done.
- Test case B: All unassigned tasks Done => empty state renders; Done unassigned tasks are not listed.
- Test case C: Milestone-assigned group behavior remains intact (milestone tasks still render per existing logic).
- **Covers AC #5 and guards AC #3.**

## Verification Plan
1. `bun test src/test/web-milestones-page-unassigned-filter.test.tsx`
2. `bunx tsc --noEmit`
3. `bun run check .`
4. `bun test src/web/utils/milestones.test.ts` (targeted regression safety for milestone utility behavior)

## Definition of Done Mapping
- **DoD #1:** Satisfied by `bunx tsc --noEmit`.
- **DoD #2:** Satisfied by `bun run check .`.
- **DoD #3:** Satisfied by targeted web test command(s) above (and broaden to full suite if needed).

## Expected Files
- `src/web/components/MilestonesPage.tsx`
- `src/test/web-milestones-page-unassigned-filter.test.tsx`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Unassigned-specific filtering in `MilestonesPage` by excluding tasks with Done/Complete status only in the Unassigned render path; shared milestone bucket generation in `core/milestones.ts` was intentionally left unchanged to avoid CLI/milestone-group regressions.

Updated Unassigned header count and show-more logic to use the filtered non-Done list, and added an explicit empty state message when all unassigned tasks are filtered out.

Simplified status-done detection usage in `MilestonesPage` by importing and reusing `isDoneStatus` from shared milestone utilities instead of maintaining a local duplicate predicate.

Added `src/test/web-milestones-page-unassigned-filter.test.tsx` covering: mixed unassigned Done/non-Done filtering + count, all-Done unassigned empty state, and milestone-group rendering non-regression.

Verification evidence: `bun test src/test/web-milestones-page-unassigned-filter.test.tsx` => PASS (3 tests, 0 failed).

Verification evidence: `bun run check .` => PASS (`biome check` completed with no issues).

Verification evidence: `bun test src/web/utils/milestones.test.ts` => PASS (14 tests, 0 failed), confirming milestone utility behavior unchanged.

Verification evidence: `bunx tsc --noEmit` => FAIL due existing unrelated errors in `src/cli.ts` (`arg` possibly undefined at lines 298 and 299). No `src/cli.ts` changes were made in this task; failure is outside BACK-387 scope.

Retrospective simplification applied: removed local Done-status predicate duplication in `MilestonesPage` by reusing shared `isDoneStatus` utility.

PR creation attempt blocked: `gh pr create --title "BACK-387 - Hide Done tasks from Unassigned group on Milestones page" ...` failed with `none of the git remotes configured for this repository point to a known GitHub host` because this dedicated clone's `origin` points to local path `/Users/alex/projects/Backlog.md` instead of GitHub.

Additional evidence for typecheck baseline: running `bunx tsc --noEmit` in `/Users/alex/projects/Backlog.md` (outside dedicated clone) shows the same existing `src/cli.ts` line 298/299 errors, confirming DoD #1 failure is pre-existing and unrelated to BACK-387 changes.

Committed changes on branch `tasks/back-387-hide-done-unassigned` as `1ca685a` with message `BACK-387 - Hide Done tasks from Unassigned group on Milestones page`.

Updated clone remote to GitHub (`https://github.com/MrLesk/Backlog.md.git`), pushed branch `tasks/back-387-hide-done-unassigned`, and created PR: https://github.com/MrLesk/Backlog.md/pull/540

Re-ran `bunx tsc --noEmit` after PR creation; it still fails only with pre-existing baseline errors in `src/cli.ts` at lines 298 and 299 (`TS18048: 'arg' is possibly 'undefined'`). This remains an external blocker for DoD #1 and task finalization.

TPM dependency note: DoD #1 is blocked by repository baseline TS18048 in `src/cli.ts` (fixed in PR https://github.com/MrLesk/Backlog.md/pull/539 under BACK-393). Re-run `bunx tsc --noEmit` after that baseline fix is merged/rebased, then finalize task.

2026-02-21T20:17:44Z evidence: baseline check on branch `main` -> `bunx tsc --noEmit` exited 0 with no TypeScript errors.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
