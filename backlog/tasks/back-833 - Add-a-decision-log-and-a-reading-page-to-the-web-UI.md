---
id: BACK-833
title: Add a decision log and a reading page to the web UI
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - web
dependencies:
  - BACK-828
  - BACK-740
references:
  - src/web/components/DecisionDetail.tsx
  - src/web/components/SideNavigation.tsx
priority: medium
type: enhancement
ordinal: 429000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decisions were added to the web UI early and never finished. They can only be reached through the list in the sidebar: `/decisions` shows "No decision selected". Nothing shows the statuses of all decisions at a glance, the decision that replaces a superseded one (`superseded_by`, BACK-738) is never shown, the status label has no dark styling, and an ID that does not exist renders a page with a blank ID.

The web redesign approved by the maintainer on 2026-11-23 gives decisions a log and a reading page. The log lists decisions newest first with status, ID, title and date. The page shows the sections Context, Decision, Consequences and Alternatives in a readable column with an outline, and the status, date, last update and superseded-by as properties.

This slice follows the slice that introduces the colors, type and page shell, and builds on BACK-740, which adds the editor and the status control. It adds no editing path of its own.

To settle with the maintainer at plan review: the drawing shows Accept and Reject buttons on a proposed decision. BACK-745 makes the list of decision statuses configurable, so the plan has to say how such shortcuts map to configured statuses, or leave status changes to the control from BACK-740.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The /decisions page lists every decision newest first with status, ID, title and date, and a superseded decision names and links the decision that replaces it.
- [ ] #2 The log can be narrowed by status, using the decision statuses of the project, and by a search box that matches title and ID.
- [ ] #3 The sidebar has one Decisions entry with the decision count in place of the decision list.
- [ ] #4 A decision opens as a reading page with the title, ID and date, the sections Context, Decision, Consequences and Alternatives in that order, and an outline of them. An empty section says that nothing is recorded, and text the file holds outside the four sections is still shown.
- [ ] #5 The page shows status, date, last update and superseded-by as properties, and a superseded decision links to the decision that replaces it.
- [ ] #6 A decision in the proposed status is marked as waiting for a decision in the log and on its page.
- [ ] #7 The status is changed only through the control and save path that BACK-740 provides.
- [ ] #8 An ID that does not exist shows a not-found message with a link back to the log.
- [ ] #9 The log offers New decision, and the log and the page have clear empty, loading and error states in light and dark.
- [ ] #10 Both are checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone, and tests cover the log order, the status filter and the not-found state.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
