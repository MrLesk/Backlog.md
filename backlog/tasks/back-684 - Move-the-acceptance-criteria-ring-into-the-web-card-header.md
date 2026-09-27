---
id: BACK-684
title: Move the acceptance-criteria ring into the web card header
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 21:40'
updated_date: '2026-09-02 22:17'
labels: []
dependencies: []
ordinal: 316000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On web board cards the acceptance-criteria ring renders on its own line under the title, so a 12px ring and a 3/5 label cost a full row of card height on every In Progress card with criteria. It is metadata, and the card already has a metadata row: the header with the task ID, type and project badges on the left and the priority badge on the right.

Move the ring into that header row on the right, beside the priority badge, so the title stays clean and cards with progress get shorter rather than taller. The list view already renders the ring in its own column and is not part of this change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On board cards the acceptance-criteria ring renders in the header row on the right, beside the priority badge, and no longer occupies its own line under the title
- [x] #2 Cards without progress or without a priority badge keep their current header layout
- [x] #3 The task list rendering of the ring is unchanged
- [x] #4 A rendering test covers a card with both a priority badge and progress
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In src/web/components/TaskCard.tsx compute the priority badge once (getPriorityBadge(task.priority)) alongside the existing acceptanceCriteriaProgress counts.
2. Replace the header row's inline IIFE right side with a right group rendered only when there is a priority badge or acceptance-criteria progress: a shrink-0 flex row holding the priority badge (unchanged classes) and <AcceptanceCriteriaProgress task={task} density="card" />. Left id/type/project group keeps min-w-0.
3. Remove the standalone <AcceptanceCriteriaProgress ... className="mt-2" /> line under the title; the card gets shorter instead of taller.
4. Leave AcceptanceCriteriaProgress and the TaskList density="list" usage untouched; no helper text, nothing reserved when either side is absent.
5. Extend src/test/web-task-acceptance-progress.test.tsx with header-placement cases: priority + progress (ring inside the header row, no progress node outside it), progress without priority, and neither (header unchanged, no empty right group).
6. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved the acceptance-criteria ring from its own line under the title into the card header row's right side in src/web/components/TaskCard.tsx. getPriorityBadge is now called once into priorityBadge; the header's right group renders only when there is progress or a priority badge, so cards with neither still render nothing beside the id. The group is 'flex shrink-0 items-center gap-2' with the ring first and the priority chip last, which keeps the chip flush right exactly where cards without progress already put it, and keeps the min-w-0 id/type/project group as the only side that gives way. AcceptanceCriteriaProgress itself and the TaskList density=list usage are untouched.

Rendered verification on a local browser board (127.0.0.1, light and dark): BACK-636 (Medium priority, 0/4) shows 'BACK-636 ... ring 0/4 Med' on one header line and BACK-684 (no priority, 0/4) shows the ring flush right, with no progress node outside the header on either card. Measured in the DOM: re-inserting the old standalone line under the title grew the BACK-636 card from 101px to 129px, so the header placement saves 28px (~22%) per card with progress. Squeezing a card that carries a type badge from 260px down to 130px kept the header a single 20px line with zero overflow - the right group holds its width and the left group truncates instead of wrapping.

Extended src/test/web-task-acceptance-progress.test.tsx with four card cases (ring plus priority badge, ring without priority, priority without progress, neither). The two placement cases fail against the pre-change component, confirming they cover the move.
<!-- SECTION:NOTES:END -->
