---
id: BACK-614
title: Let the web create form express an explicitly unassigned task
status: To Do
assignee: []
created_date: '2026-08-09 13:49'
labels: []
dependencies: []
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by Alex 2026-08-09. Since BACK-604, the web create modal omits the assignee field when the chip input is blank so defaultAssignee still applies, which means the create form cannot express "explicitly unassigned" while a default is configured (edit can, via empty list). Suggested minimal mechanism, verify feasibility during planning: when defaultAssignee is configured, pre-fill the create form assignee field with the default as a removable chip; if the user removes it, the form sends an explicit empty list (unassigned); if they leave it, the default applies. No new UI copy or controls beyond the prefilled chip; keep the no-default behavior unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With defaultAssignee configured, a user can create an explicitly unassigned task from the web create form
- [ ] #2 Leaving the form untouched still applies defaultAssignee; projects without a default are unchanged
- [ ] #3 Edit-mode clearing behavior is unchanged
- [ ] #4 Tests cover the three states: default applied, explicitly unassigned, explicit assignee
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
