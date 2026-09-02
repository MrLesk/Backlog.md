---
id: BACK-681
title: Show due dates on the surfaces that omit them
status: To Do
assignee: []
created_date: '2026-09-02 20:31'
labels: []
dependencies: []
ordinal: 313000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A due date set through any surface is silently absent from several read surfaces: board export and non-TTY board render a task row with no date (src/board.ts around line 151, used by src/cli.ts around 4598 and src/ui/board.ts around 334), draft list --plain omits it (src/cli.ts around 4043), and the web drafts list omits it (src/web/components/DraftsList.tsx around 149).

Nothing shifts or corrupts the value; it simply is not displayed, so a user who sets a due date sees it in some places and not others and cannot tell which surfaces are authoritative. Found while auditing the due-date model after BACK-678 made due dates a plain calendar day.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Board export and non-TTY board output show a task due date when one is set
- [ ] #2 draft list --plain and the web drafts list show a due date when one is set
- [ ] #3 Surfaces without a due date are unchanged, with no empty column or placeholder introduced
- [ ] #4 Tests cover each surface with and without a due date
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
