---
id: BACK-764
title: Add an Archive button to the web document and decision pages
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-13 18:47'
updated_date: '2026-10-14 06:36'
labels:
  - enhancement
dependencies:
  - BACK-763
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
  - core
  - web-server
modified_files:
  - src/core/backlog.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/RecordArchive.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/test/server-content-record-archive.test.ts
  - src/test/web-record-archive.test.tsx
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
- [x] #1 The document page shows an `Archive` button in its header while a saved document is open in view mode. The button is not shown while the document is being edited and not on the new document page.
- [x] #2 The decision page shows an `Archive` button in its header while a saved decision is open in view mode. The button is not shown while the decision is being edited and not on the new decision page.
- [x] #3 Clicking `Archive` asks for confirmation with the same kind of dialog the task Archive button uses. The question names the record's title, says that the record leaves the sidebar and search, and names the CLI command that restores it (`backlog doc restore <id>` or `backlog decision restore <id>`).
- [x] #4 Cancelling the confirmation sends no request and changes nothing.
- [x] #5 Confirming archives the record through the server: `POST /api/docs/<id>/archive` for a document and `POST /api/decisions/<id>/archive` for a decision. The result on disk is the same as after `backlog doc archive` or `backlog decision archive`, including what auto-commit does.
- [x] #6 After a successful archive the record is gone from the sidebar and from web search without a page reload, and the page navigates to `/documentation` for a document or `/decisions` for a decision.
- [x] #7 When the archive is refused, for example because the archive folder already has a file of that name, the page stays on the record, shows the message the server returned, and the record stays in the sidebar.
- [x] #8 The two routes answer 404 for an ID that no record claims, 409 for an ambiguous ID, and 400 with a JSON `error` holding the core message for any other refusal.
- [x] #9 When the server reports that the record was archived but committing the change failed, the browser tells the user so, as the task Archive button does, and treats the record as archived: it leaves the sidebar and the page navigates away.
- [x] #10 While an archive request is running, the button cannot start a second one.
- [x] #11 Opening the URL of an archived document or decision shows the record with a visible `Archived` label and with no `Edit` button and no `Archive` button. This follows the task details view, which shows an archived task as read-only.
- [x] #12 The web has no control and no HTTP route that deletes or restores a document or a decision.
- [x] #13 The button label is `Archive`. No subtitle, helper text or description is added under the button or under any heading.
- [x] #14 The server routes and the web code hold no archive rule of their own: every refusal message shown in the browser is the message the CLI prints for the same case.
- [x] #15 The button, the confirmation and the archived state are checked in the running browser UI at desktop width and at a narrow width, in the light and the dark theme, with keyboard access to the button, not by tests alone.
- [x] #16 Tests cover, for documents and for decisions: the button's visibility in each state, cancel, confirm with navigation, a refusal showing its message, an archived record opened by URL, and the two routes for success, not found, ambiguous and refused.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: an archive whose commit fails after the move is tagged for the browser (markRecordAlreadyMoved, archiveState), as task archive is. Nothing else in core changes; the routes call archiveContentRecord with the kind.
2. Server: POST /api/docs/<id>/archive and POST /api/decisions/<id>/archive share one thin handler that maps core's answer to HTTP the way the task archive route does: 404 with core's not-found message, 409 for an ambiguous ID, 400 with the message of any refusal, 500 with archiveState moved when only the commit failed, and a data broadcast after a move.
3. Web: one shared module for both pages (the hook that confirms, sends one request at a time, refreshes and navigates, and the Archive button, the Archived label and the refusal alert). It extends the task Archive flow of the task details view: window.confirm, then the request, then on archiveState moved an alert and the record treated as archived. The API client gains archiveDoc and archiveDecision without retry.
4. Pages: the document page and the decision page show Archive in the header in view mode for a saved record, hide it while editing, on the new page and for an archived record; an archived record shows the Archived label and no Edit. A refusal is shown with the server's message and the page stays.
5. Tests: the two routes (success with the result on disk and in the lists, not found, ambiguous, refused, moved with a failed commit), and the two pages in JSDOM (visibility in each state, cancel, confirm with navigation, refusal, moved with a failed commit, one request at a time, archived record by URL).
6. Check the running browser UI at desktop and narrow width, in light and dark theme, with the keyboard, and save screenshots to the scratchpad.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flow extended: the Archive button of the task details view (TaskDetailsModal.handleArchive with App.handleArchiveTask). Same native window.confirm, a request without retry (fetchWithoutRetry), a refusal shown with core's message while the page stays, and archiveState moved treated as archived (alert, refresh, leave the page). The alert shows core's sentence rather than the task flow's fixed sentence, so every message the browser shows comes from core.

Server: one handler, handleArchiveContentRecord(kind, id), behind POST /api/docs/<id>/archive and POST /api/decisions/<id>/archive. It calls Core.archiveContentRecord and maps the answer as handleArchiveTask does: 404 with CONTENT_RECORD_WORDS[kind].notFound, 409 ambiguous, 400 RecordRefusedError, 500 with archiveState moved, broadcast after a move. It returns {success: true} and no describeContentRecordChange lines: the page shows no success message and the web shows no list of tasks naming the file (task scope).

Core: moveContentRecord tags the commit failure of an archive with markRecordAlreadyMoved(failure, 'archiveState'). Restore and delete are not tagged; the web has no route for them.

Web: src/web/components/RecordArchive.tsx holds the hook and the three pieces (ArchiveButton, ArchivedLabel, ArchiveRefusal) for both pages; ARCHIVABLE_PAGES is the only per-kind table (list path, restore command, API call). A ref guards double submission, as state alone lets two clicks in one render through.

Header wrap (base change, both pages): found in the browser check. The metadata row never wrapped, so its full width was the title column's minimum and the header buttons were pushed past main, which has overflow-x hidden. With Archive beside Edit, Archive was cut off at a 920px window with the sidebar open (right edge 988) while Edit alone fitted. The header row now wraps (gap-x-6 replaces ml-6 on the buttons) and the metadata row wraps (gap-x-6 gap-y-2 replaces space-x-6). Measured: the header needs 380px of main width with Archive, against 562px for Edit alone before. Where everything fits on one line the page is unchanged.

Browser check (criterion 15), against a binary built from the branch in a mktemp project: 1280, 920 with the sidebar open, 768 and 375 wide; light and dark; Tab from the title reaches Archive with a focus ring and Enter archives (decision-1 left the sidebar, the page went to /decisions, commit 'backlog: Archive decision decision-1', R100). Refusal for doc-3 shows core's message; archived doc-2 and decision-2 by URL show the Archived label and no buttons; edit mode at 375 fits. The browser pane dismisses native dialogs on its own, so window.confirm was replaced by a function that records its text and answers yes; the native dialog's look was not seen. Screenshots: scratchpad/back-764/ (01 to 28). HTTP and CLI transcript: scratchpad/back-764/http-transcript.txt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The document page and the decision page have an `Archive` button. It extends the Archive flow of the task details view: a native confirmation that names the title, says the record leaves the sidebar and search, and gives the CLI restore command; one request at a time, without retry; core's message shown under the header when the archive is refused, with the page staying; and a record that moved while only the commit failed treated as archived (alert with core's sentence, refresh, list page). An archived record opened by URL shows an `Archived` label and neither Edit nor Archive. The web has no delete or restore control and no route for them.

The server has two thin routes, `POST /api/docs/<id>/archive` and `POST /api/decisions/<id>/archive`, with one handler that calls `Core.archiveContentRecord` with the kind and maps its answer as the task archive route does (404, 409, 400 with core's message, 500 with `archiveState: "moved"`). Core changed in one place: the commit failure of an archive is tagged for the browser, as task archive's is. Both pages share `src/web/components/RecordArchive.tsx`.

The browser check found that Archive was cut off at common window widths, because the header's metadata row never wrapped. The header row and the metadata row of both pages now wrap; where everything fits on one line, the page is unchanged.

Verification: `bunx tsc --noEmit` and `bun run check .` clean; `server-content-record-archive` 16 and `web-record-archive` 16 new tests pass, with the archive, server and web test files of the stack; `bun run test` 3,255 pass, 8 skip, 0 fail across 309 files (it exits 1 with no failing test, as on the base). Checked in the running browser against a built binary at 1280, 920, 768 and 375 pixels wide, in light and dark, with the keyboard (Tab to Archive, Enter archives). The native dialog itself could not be shown in the browser pane, which dismisses native dialogs; its text was recorded from the page.
<!-- SECTION:FINAL_SUMMARY:END -->
