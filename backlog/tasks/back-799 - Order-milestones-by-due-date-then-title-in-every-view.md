---
id: BACK-799
title: Order milestones by due date, then title, in every view
status: In Progress
assignee:
  - '@dake84'
created_date: '2026-11-03T20:08:00Z'
updated_date: '2026-11-03T21:50:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1170
modified_files:
  - src/utils/milestone-order.ts
  - src/file-system/operations.ts
  - src/ui/board.ts
  - src/web/components/MilestonesPage.tsx
  - CLI-INSTRUCTIONS.md
  - src/test/cli-milestone-management.test.ts
  - src/test/web-milestones-page-search.test.tsx
  - src/web/lib/lanes.test.ts
ordinal: 405000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Milestones appear in different orders depending on the surface: the CLI milestone list, the browser board lanes and the Milestones page follow the numeric ID, while the TUI milestone filter sorts titles alphabetically. Inserting a milestone between existing phases therefore leaves it at the end of the ID-ordered views, and renaming it does not move it (issue #1170). One shared order fixes both: milestones with a due date first, earliest first; then by title (natural order, so 'Sprint 2' precedes 'Sprint 10'); the ID breaks ties. Completed milestones stay grouped apart as today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CLI milestone list, the browser board's milestone lanes, the browser Milestones page and the TUI milestone filter show milestones in the same order
- [x] #2 Milestones with a due date come first, earliest first; milestones without one follow, ordered by title in natural order; the ID breaks ties
- [x] #3 Changing a milestone's title or due date changes its position without changing its ID or its tasks
- [x] #4 CLI instructions describe the milestone order
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add compareMilestones in src/utils (due date asc, undated after; natural title order; ID tiebreak) and use it in FileSystem.listMilestonesInDirectory, the shared source for CLI list, board lanes and core buckets.
2. Drop the ID re-sort in MilestonesPage (keep active/empty/completed grouping) and the localeCompare sort of the TUI filter titles in ui/board.ts, so entity order holds.
3. Describe the order in CLI-INSTRUCTIONS.md.
4. Adapt the Milestones page order test; add one listMilestones test for due date, natural title and ID tiebreak.
5. Run check:types, check, test; self-review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared comparator compareMilestones in src/utils/milestone-order.ts, used by FileSystem.listMilestonesInDirectory; MilestonesPage and the TUI filter keep the entity order. Verified: check:types and check pass; 91 milestone-related test files pass (1183 tests); real 'milestone list' printed Sooner, Later, Sprint 2, Sprint 10. Full suite: 21-22 failures that also occur only under load; the same files pass alone on this branch, and 3 nix-script tests fail identically on unmodified main. AC 1 is proven for the CLI list; board lanes, Milestones page and TUI filter inherit the order from the entity list and have no test of their own.

AC 1 holds with one existing exception kept on purpose: the Milestones page still groups milestones with tasks before empty ones, as before; the order inside each group is the shared one. Verified in the browser (Milestones page, board lanes) and the TUI milestone filter on a demo project.
<!-- SECTION:NOTES:END -->
