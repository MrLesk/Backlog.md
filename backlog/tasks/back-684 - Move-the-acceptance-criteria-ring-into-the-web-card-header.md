---
id: BACK-684
title: Move the acceptance-criteria ring into the web card header
status: To Do
assignee: []
created_date: '2026-09-02 21:40'
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
- [ ] #1 On board cards the acceptance-criteria ring renders in the header row on the right, beside the priority badge, and no longer occupies its own line under the title
- [ ] #2 Cards without progress or without a priority badge keep their current header layout
- [ ] #3 The task list rendering of the ring is unchanged
- [ ] #4 A rendering test covers a card with both a priority badge and progress
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
