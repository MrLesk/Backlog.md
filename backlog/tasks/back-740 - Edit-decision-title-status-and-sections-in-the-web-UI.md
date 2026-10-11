---
id: BACK-740
title: 'Edit decision title, status and sections in the web UI'
status: To Do
assignee: []
created_date: '2026-10-11 19:09'
updated_date: '2026-10-11 19:24'
labels:
  - enhancement
dependencies:
  - BACK-737
  - BACK-745
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: enhancement
ordinal: 358000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web UI shows decisions but cannot edit them properly. The Edit button on the decision page is hidden because editing was never finished, yet the editor behind it is still reachable through the `edit=true` URL parameter and is used when a decision is created. It edits the whole body as one block of text, which is the save that loses content in issue #1065. It cannot change the status, and when a save fails the error goes only to the browser console, so the user sees nothing.

The maintainer's ruling on issue #1065 is that the web decision editor may change the title, the status and the four section fields (Context, Decision, Consequences, Alternatives), through the same core functions the CLI uses and with no logic of its own. The status control offers the decision statuses configured for the project, which BACK-745 adds. Text in the file outside the four sections is kept by the core and is not editable here.

This extends the existing decision page and its create flow, and follows the edit, save and cancel behavior of the task editor instead of introducing a new interaction.

Depends on BACK-737, which provides the JSON write endpoint and the shared core update, and on BACK-745, which provides the configured decision statuses the editor offers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The decision page offers an Edit action, and the editor has a title field, a status control that offers the configured decision statuses (BACK-745), and one field for each of Context, Decision, Consequences and Alternatives.
- [ ] #2 Saving sends title, status and section values to `PUT /api/decisions/:id` as JSON; afterwards the file contains the new values, text outside the four sections is unchanged, and the page shows the saved decision.
- [ ] #3 Saving with no changes sends no request and leaves the file untouched.
- [ ] #4 When the server rejects a save (400, 404, 409 or 500), the editor shows the error message on the page and keeps the unsaved input.
- [ ] #5 Creating a decision in the web UI still works through the shared create function, and a failed create shows its error on the page.
- [ ] #6 No editing path remains that sends the whole decision body as text; the old editor reachable through `edit=true` is replaced.
- [ ] #7 The editor is checked in the running browser UI at desktop width and at a narrow width, with keyboard access to every field, not by tests alone.
- [ ] #8 Tests cover a successful save, a rejected save showing its message, and the no-change case.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
