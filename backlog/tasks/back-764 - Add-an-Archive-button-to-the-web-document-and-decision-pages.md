---
id: BACK-764
title: Add an Archive button to the web document and decision pages
status: To Do
assignee: []
created_date: '2026-10-13 18:47'
updated_date: '2026-10-13 18:49'
labels:
  - enhancement
dependencies:
  - BACK-763
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
priority: high
type: enhancement
ordinal: 385000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1101 asks for a way to retire a document from the web UI: the document page offers Edit and nothing to remove the document. The earlier tasks of this stack (BACK-761, BACK-762, BACK-763) add archive, delete and restore for documents and decisions on the CLI, and for documents on MCP. A person who works in the browser still has to switch to a terminal to archive a document or a decision.

The owner's ruling is that the web gets an Archive button only, on the document page and on the decision page, with a confirmation dialog. Delete and restore stay on the CLI (and on MCP for documents). Tasks already have this split: the task details view has an Archive button and no delete or restore control.

Rules from the ruling that shape this task:

- The server calls the same core archive function the CLI calls. No rule lives in the web code or in the server route. They pass the ID and show the answer.
- The flow extends the existing task Archive button in the task details view: the same kind of confirmation, and a refusal is shown with the message core gives.
- The project's UI rule applies (`CLAUDE.md`, "UI descriptions"): one self-explanatory label, and no helper text under headings or buttons unless it is needed to prevent an error.

Scope:

- No Delete control and no Restore control is added to the web, and no HTTP route for them. Because the web cannot restore, the confirmation dialog names the CLI command that does.
- The decision page has no visible Edit button today (it is hidden until BACK-740), so Archive is the only button on that page in view mode.
- The web shows no list of the tasks that name the archived file. That list is printed by the CLI and returned by MCP.

This is the last of four stacked tasks for issue #1101. Each is one branch and one pull request. This one builds on BACK-763.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The document page shows an `Archive` button in its header while a saved document is open in view mode. The button is not shown while the document is being edited and not on the new document page.
- [ ] #2 The decision page shows an `Archive` button in its header while a saved decision is open in view mode. The button is not shown while the decision is being edited and not on the new decision page.
- [ ] #3 Clicking `Archive` asks for confirmation with the same kind of dialog the task Archive button uses. The question names the record's title, says that the record leaves the sidebar and search, and names the CLI command that restores it (`backlog doc restore <id>` or `backlog decision restore <id>`).
- [ ] #4 Cancelling the confirmation sends no request and changes nothing.
- [ ] #5 Confirming archives the record through the server: `POST /api/docs/<id>/archive` for a document and `POST /api/decisions/<id>/archive` for a decision. The result on disk is the same as after `backlog doc archive` or `backlog decision archive`, including what auto-commit does.
- [ ] #6 After a successful archive the record is gone from the sidebar and from web search without a page reload, and the page navigates to `/documentation` for a document or `/decisions` for a decision.
- [ ] #7 When the archive is refused, for example because the archive folder already has a file of that name, the page stays on the record, shows the message the server returned, and the record stays in the sidebar.
- [ ] #8 The two routes answer 404 for an ID that no record claims, 409 for an ambiguous ID, and 400 with a JSON `error` holding the core message for any other refusal.
- [ ] #9 When the server reports that the record was archived but committing the change failed, the browser tells the user so, as the task Archive button does, and treats the record as archived: it leaves the sidebar and the page navigates away.
- [ ] #10 While an archive request is running, the button cannot start a second one.
- [ ] #11 Opening the URL of an archived document or decision shows the record with a visible `Archived` label and with no `Edit` button and no `Archive` button. This follows the task details view, which shows an archived task as read-only.
- [ ] #12 The web has no control and no HTTP route that deletes or restores a document or a decision.
- [ ] #13 The button label is `Archive`. No subtitle, helper text or description is added under the button or under any heading.
- [ ] #14 The server routes and the web code hold no archive rule of their own: every refusal message shown in the browser is the message the CLI prints for the same case.
- [ ] #15 The button, the confirmation and the archived state are checked in the running browser UI at desktop width and at a narrow width, in the light and the dark theme, with keyboard access to the button, not by tests alone.
- [ ] #16 Tests cover, for documents and for decisions: the button's visibility in each state, cancel, confirm with navigation, a refusal showing its message, an archived record opened by URL, and the two routes for success, not found, ambiguous and refused.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
