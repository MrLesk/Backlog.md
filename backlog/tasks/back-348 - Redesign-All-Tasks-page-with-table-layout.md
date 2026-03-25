---
id: BACK-348
title: Redesign All Tasks page with table layout
status: Done
assignee:
  - '@codex'
created_date: '2025-12-17 19:32'
updated_date: '2026-02-21 20:18'
labels:
  - web-ui
  - design
  - enhancement
  - ux
dependencies: []
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
The new task table in the Milestones page looks clean, scannable, and professional. The current All Tasks page uses a card-based layout that takes more vertical space and is harder to scan when you have many tasks. Adopting the table pattern would create visual consistency and improve the UX.

### Design Vision
Use the Milestones task table as a foundation, but enrich it for the All Tasks context where users need more information at a glance.

#### Columns to include
| Column | Notes |
|--------|-------|
| ID | Monospace, left-aligned (like Milestones) |
| Title | Truncate with ellipsis, flex-grow |
| Status | Badge/pill |
| Priority | Badge/pill (or dash if none) |
| Labels | Compact chips, show first 2 + "+N" overflow |
| Assignee | Avatar or initials, or chips |
| Milestone | Text or badge |
| Created | Relative date ("2d ago") or short date |

#### Enhanced features (beyond Milestones table)
- **Sortable columns**: Click column header to sort (toggle asc/desc), show sort indicator
- **Sticky header**: Keep column headers visible when scrolling long lists
- **Cross-branch styling**: Subtle row background tint instead of banner (more compact)
- **Column density**: Consider compact row height for power users
- **Responsive behavior**: Horizontal scroll on narrow screens, or priority columns only

#### Keep existing functionality
- All filter controls (search, status, priority, milestone, labels)
- Filter count display
- Click row to open task details
- Clean up button for Done tasks
- Empty state messaging

### Out of scope (for this task)
- Drag-and-drop (not needed here)
- Column visibility toggle (future enhancement)
- Bulk selection/actions (future enhancement)

### Related
- Reuse table styling from `MilestonesPage.tsx` (grid layout, header row, row hover states)
- Keep filter bar implementation from current `TaskList.tsx`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All Tasks page renders tasks in a compact table layout (not cards) with columns: ID, Title, Status, Priority, Labels, Assignee, Milestone, and Created.
- [x] #2 Table redesign preserves existing behavior: filter controls (search/status/priority/milestone/labels), filter count text, row click opens task details, cleanup button visibility for Done filter, and empty-state messaging.
- [x] #3 Sortable column headers are available for appropriate columns, toggling ascending/descending with a visible sort indicator; default ordering remains aligned with current newest-first behavior.
- [x] #4 Table header remains visible while scrolling task rows, and narrow screens remain usable via responsive horizontal scrolling without layout breakage.
- [x] #5 Cross-branch tasks are visually identifiable in compact form using subtle row-level styling (replacing banner-style treatment) without changing editability rules.
- [x] #6 Created date display is concise and consistent, and handles missing/invalid dates gracefully.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Context-hunter micro-brief (L1)
- Closest analog: `src/web/components/MilestonesPage.tsx` + `src/web/components/MilestoneTaskRow.tsx` for compact grid-table visual language.
- Closest behavioral baseline: current `src/web/components/TaskList.tsx` filter/search URL sync, API-backed filtering, cleanup flow, and row click-to-open details.
- Main risk: introducing sorting + sticky header without regressing current filtering, cross-branch signaling, cleanup button behavior, and empty states.

## Proposed AC (for TPM review only; not applied yet)
1. All Tasks page renders tasks in a compact table layout (not cards) with columns: ID, Title, Status, Priority, Labels, Assignee, Milestone, Created.
2. Table preserves current behavior: filter controls (search/status/priority/milestone/labels), count text, row click opens task details, cleanup button for Done filter, and existing empty-state semantics.
3. Sortable columns are implemented via clickable headers with asc/desc toggle and visible indicator; default sort remains newest-first by task ID.
4. Header row remains visible while scrolling task rows (sticky header) and layout remains usable on narrow screens via horizontal scrolling.
5. Cross-branch tasks are visually identifiable in compact form using subtle row tint/read-only treatment (no full-width banner), while remaining editable constraints are unchanged.
6. Date display in Created column is consistent and human-scannable (relative or short-date strategy) and handles invalid/missing dates gracefully.

## Proposed DoD checks (for TPM review only; not applied yet)
1. Implementation plan in this task reflects final agreed approach.
2. Lint/format checks pass for changed files.
3. Type-check passes.
4. Relevant automated tests for introduced sort/date/table logic pass.
5. Manual web smoke checks pass for filters, sorting, sticky header, row open, cleanup visibility, empty state, and cross-branch row styling.
6. Implementation notes capture deviations/decisions discovered during execution.

## Concrete implementation plan (mapped)
1. Replace TaskList card rendering with table container while retaining existing toolbar/filter/cleanup/empty-state structure in place.
- Maps to AC: 1, 2
- Expected file: `src/web/components/TaskList.tsx`

2. Add table column renderers and compact cell styles (truncate title, status/priority badges, first-two labels + overflow count, assignee chips/initials, milestone label, created date cell).
- Maps to AC: 1, 6
- Expected file: `src/web/components/TaskList.tsx`

3. Implement sort state and comparator logic for supported columns with deterministic handling of missing values and stable toggle behavior (asc/desc + indicator).
- Maps to AC: 3, 6
- Expected file: `src/web/components/TaskList.tsx`
- Expected file (if extracted for reuse/testability): `src/web/utils/date-display.ts`

4. Implement sticky header + responsive horizontal scroll wrapper and update cross-branch visual treatment from banner to subtle row-level styling.
- Maps to AC: 4, 5
- Expected file: `src/web/components/TaskList.tsx`

5. Add/extend tests for any extracted date/sort helpers and ensure existing date utility coverage remains valid.
- Maps to AC: 3, 6 and DoD: 4
- Expected file (if helper changes): `src/web/utils/date-display.test.ts`

6. Run validation sequence and capture results in task notes.
- Maps to DoD: 2, 3, 4, 5
- Verification commands:
  - `bun test src/web/utils/date-display.test.ts`
  - `bunx tsc --noEmit`
  - `bun run check src/web/components/TaskList.tsx src/web/utils/date-display.ts src/web/utils/date-display.test.ts`
  - `bun test` (full suite, final confidence pass)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Planning note: BACK-348 currently has no AC/DoD checklist entries. Proposed AC and DoD checks are captured in the implementation plan section for TPM review only. I did not modify Acceptance Criteria or Definition of Done fields.

TPM refinement: Added explicit acceptance criteria and standard DoD checklist to make completion objectively verifiable while preserving original scope/design vision.

Implementation started in dedicated clone branch `tasks/back-348-all-tasks-table-redesign` with strict scope to TaskList table redesign AC/DoD. Initial focus: replace card rendering with compact sortable table while preserving existing filter/search/cleanup behaviors.

Implementation decisions:
- Replaced card list rendering in `TaskList` with a compact, responsive table (`overflow-x-auto`, fixed column widths) while preserving existing filter controls, URL-sync behavior, count text, cleanup button logic, row click-to-open, and empty-state behavior.
- Implemented sortable headers for ID/Title/Status/Priority/Milestone/Created with asc/desc toggle and visible indicators; kept default ordering as newest-first (`id` desc).
- Replaced cross-branch banner treatment with subtle row-level tint and compact branch chip in title cell (read-only signaling preserved without changing editability rules).
- Added concise Created-date formatter (`formatStoredUtcDateForCompactDisplay`) with graceful handling for empty/invalid values and test coverage.
- Retrospective simplification: consolidated repeated sortable header JSX into a single `renderSortableHeader` helper to reduce duplication.

Verification evidence:
- `bun test src/web/utils/date-display.test.ts` -> PASS (9 passed, 0 failed).
- `bun run check src/web/components/TaskList.tsx src/web/utils/date-display.ts src/web/utils/date-display.test.ts` -> PASS (Biome check clean).
- `bun run check .` -> PASS (Biome check clean).
- `bunx tsc --noEmit` -> FAIL due pre-existing unrelated errors in `src/cli.ts:298` and `src/cli.ts:299` (`arg` possibly undefined).
- Baseline confirmation run in primary repo (`/Users/alex/projects/Backlog.md`): `bunx tsc --noEmit` reports the same `src/cli.ts` errors, indicating this is not introduced by BACK-348 changes.
- `bun test` run completed with exit code 0 in this environment; output still includes `runtime-cwd.test.ts` path-normalization assertions showing `/var/...` vs `/private/var/...` mismatch, which appears environment-specific and unrelated to BACK-348 files.

PR opened: https://github.com/MrLesk/Backlog.md/pull/541

TPM gate correction: reopened task and unchecked DoD #1 because `bunx tsc --noEmit` currently fails on pre-existing baseline errors in `src/cli.ts` unrelated to this task. Task remains implementation-complete but blocked on repository typecheck baseline resolution.

TPM dependency note: DoD #1 remains blocked by repository baseline TS18048 in `src/cli.ts` (addressed in PR https://github.com/MrLesk/Backlog.md/pull/539 under BACK-393). Re-run `bunx tsc --noEmit` after baseline update, then finalize task.

2026-02-21T20:17:44Z evidence: baseline check on branch `main` -> `bunx tsc --noEmit` exited 0 with no TypeScript errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented BACK-348 by redesigning the web All Tasks view into a compact, sortable table while preserving all existing list behaviors.

What changed:
- Replaced card-based task rendering in `src/web/components/TaskList.tsx` with a compact table layout including columns: ID, Title, Status, Priority, Labels, Assignee, Milestone, Created.
- Added sortable headers (ID, Title, Status, Priority, Milestone, Created) with asc/desc toggle and visible indicators; default sort remains newest-first by ID.
- Added sticky table header and horizontal overflow handling for narrow viewports.
- Replaced cross-branch banner treatment with subtle row-level styling plus compact branch chip (read-only signaling retained).
- Added concise Created date formatter (`formatStoredUtcDateForCompactDisplay`) in `src/web/utils/date-display.ts` and coverage in `src/web/utils/date-display.test.ts`.
- Included generated style artifact updates in `src/web/styles/style.css` for new table utility classes.

Verification evidence:
- `bun test src/web/utils/date-display.test.ts` -> pass (9 passed, 0 failed).
- `bun run check src/web/components/TaskList.tsx src/web/utils/date-display.ts src/web/utils/date-display.test.ts` -> pass.
- `bun run check .` -> pass.
- `bunx tsc --noEmit` -> reports pre-existing unrelated errors in `src/cli.ts:298` and `src/cli.ts:299` (`arg` possibly undefined); baseline check in `/Users/alex/projects/Backlog.md` shows the same output.
- `bun test` -> command exits 0 in this environment; output includes existing `runtime-cwd.test.ts` `/var` vs `/private/var` path-normalization assertion noise unrelated to BACK-348 files.

PR:
- https://github.com/MrLesk/Backlog.md/pull/541
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
