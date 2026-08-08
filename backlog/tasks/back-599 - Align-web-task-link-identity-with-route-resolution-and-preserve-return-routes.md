---
id: BACK-599
title: Align web task-link identity with route resolution and preserve return routes
status: To Do
assignee: []
created_date: '2026-08-07 22:31'
labels:
  - web
dependencies:
  - BACK-260
priority: low
type: bug
ordinal: 238000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two gaps found while reviewing BACK-593 (auto-linked task IDs in web markdown and dependency chips). Both are pre-existing consequences of how the web corpus is loaded, so they were deferred out of that task rather than fixed inside it.

1. Identity coverage does not match route resolution. The web UI builds its task identity index from the active tasks returned by /api/search, while route resolution covers active plus completed tasks. Two symptoms follow: a reference to a completed task never becomes a link even though the route can open it, and an active BACK-1 is linked even when a completed BACK-01 makes that route ambiguous, so the link lands on a 409. The auto-linker deliberately fails closed on ambiguity within what it can see; it cannot fail closed on what it cannot see. The proper fix depends on whether completed tasks belong in the web corpus at all, which is the product decision parked in BACK-260 (Web UI: Include completed records in All Tasks). That decision comes first; this task should follow it rather than invent a third answer.

2. Task links lose the return route. Links produced for markdown IDs and dependency chips point at a bare /tasks/<id> with no search params and no taskModalFrom state, so opening one from a filtered board or list and then closing the destination modal returns to an unfiltered /tasks. App.handleEditTask already builds the correct destination (createUrlPath plus location.search plus taskModalFrom state) and is the precedent to reuse.

Scope note: this is polish on shipped behaviour, not a regression from BACK-593. Nothing here loses user data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task references resolve through the same corpus the router resolves against, so a reference that renders as a link always opens successfully
- [ ] #2 An ID that is ambiguous across the corpora is not linked, and no auto-generated link can land on an ambiguous-ID error
- [ ] #3 Following a task link from a filtered board or list preserves the filter search params, and closing the destination task returns to the filtered view it came from
- [ ] #4 Tests cover completed-task references, ambiguous IDs, and return-route preservation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
