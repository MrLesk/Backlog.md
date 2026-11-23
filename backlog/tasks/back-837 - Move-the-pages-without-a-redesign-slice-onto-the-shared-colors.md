---
id: BACK-837
title: Move the pages without a redesign slice onto the shared colors
status: To Do
assignee: []
created_date: '2026-11-23T21:24:00Z'
labels:
  - web
dependencies:
  - BACK-828
references:
  - src/web/components/MilestonesPage.tsx
  - src/web/components/DraftsList.tsx
  - src/web/components/Statistics.tsx
  - src/web/components/Settings.tsx
  - src/web/components/InitializationScreen.tsx
  - src/web/components/Modal.tsx
priority: medium
type: enhancement
ordinal: 436000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-828 introduces the shared colors, type and page shell of the web redesign. Pages that have their own redesign task move to the new colors there: the task pages in BACK-829, the task page in BACK-830, documents in BACK-832 and decisions in BACK-833.

Milestones, Drafts, Statistics, Settings, the initialization screen and the shared dialogs have no such task. After BACK-828 they still use raw Tailwind gray and blue utilities inside the new shell, so the app looks mixed: a navy and teal shell around gray pages with blue buttons.

On 2026-11-23 the maintainer chose to keep BACK-828 small and to recolor these pages in one separate task. This is that task. It moves colors, radii and type details onto the tokens from BACK-828. It does not change the layout, the wording or the behavior of any page.

Related: BACK-668 replaces dead `rounded-full` classes in some of the same components. Whichever of the two tasks is done second should not undo the other.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Milestones, Drafts, Statistics, Settings, the initialization screen and the shared dialogs (the modal frame, cleanup, duplicate ID repair, toasts and error states) use the color, radius and type tokens from BACK-828, and no raw Tailwind gray or blue utility is left in their components.
- [ ] #2 Primary actions on these pages use the ink color with on-ink text, and focus is visible on every control in both themes.
- [ ] #3 Text on these pages reaches a contrast ratio of at least 4.5:1 and marks at least 3:1 against their background in both themes, checked by calculation.
- [ ] #4 Layout, wording, routes, filters, API requests and behavior of these pages do not change.
- [ ] #5 The pages are checked in the running browser UI in light and dark, at desktop and narrow widths.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
