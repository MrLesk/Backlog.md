---
id: BACK-764
title: Add an Archive button to the web document and decision pages
status: Done
assignee:
  - '@codex-764'
created_date: '2026-10-13 18:47'
updated_date: '2026-10-15 23:11'
labels:
  - enhancement
dependencies:
  - BACK-763
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
  - core
  - web-server
  - src/web/components/RecordArchive.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/test/web-record-archive.test.tsx
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

Repair plan approved by Alex (2026-10-16):
1. Merge repaired BACK-763 head 27030c6a527a623cd08efeb8043651461d794ad2 and verified origin/main 230b9e7e17548e068d73e6f041522f04008bf80a into the existing branch, preserving feature history and main legacy-section safety.
2. Use existing normalized document/decision identity keys for route ownership. Guard each loader lifetime through success, fallback, error, and finally; only pass a loaded record matching the route to Archive.
3. Keep one shared useRecordArchive owner. Capture the submitted route identity and suppress late refusal/alert/navigation on another route, including after awaited global refresh. Keep one request at a time and refresh app data for completed archives.
4. Add deterministic deferred-promise regressions for both pages covering stale loads, archive refusal/success/moved failures, and route change while refresh waits; preserve normal, alias, editor, new, and archived behavior.
5. Run focused route/archive/server/lifecycle/Git/link/commit/lock and inherited legacy-section checks, canonical type/lint/build checks, compiled CLI/MCP smoke, and the running browser flow. Leave source and task In Progress for full-context final architecture review; do not finalize, commit the repair, push, comment publicly, or resolve review threads.

Second route-repair round approved by Alex (2026-10-16): investigate current-head finding PRRT_kwDOO2LIE86s_81P. Add deterministic prefix-only invalid-route cases for fresh links and navigation from a loaded record on both pages; compare before the first route repair and current2ec0e373 before changing production code. If confirmed, make only the bounded loader correction so a null normalized identity clears old record state and ends loading in the existing missing/invalid-record presentation. Preserve all request-lifetime/archive ownership, aliases, new/read-only/editor behavior, inherited main/parent safety, and copy/layout. Run affected web/route/identity/API suites and relevant compiled HTTP/CLI/MCP checks plus canonical types/Biome/build. Leave source/task In Progress without commit or push for stable full-context review. Browser provider remains unavailable; do not retry it.

Confirmed second-round correction: reuse the existing No document selected / No decision selected state for a nonempty route whose normalized identity is null. Run the shared loader reset before the null check and use finally to end loading; clear old title/path in that branch. Infinite loading was introduced by2ec0e373, while in-app stale-content retention also existed before. No generic404 UI, new copy, or loading layer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flow extended: the Archive button of the task details view (TaskDetailsModal.handleArchive with App.handleArchiveTask). Same native window.confirm, a request without retry (fetchWithoutRetry), a refusal shown with core's message while the page stays, and archiveState moved treated as archived (alert, refresh, leave the page). The alert shows core's sentence rather than the task flow's fixed sentence, so every message the browser shows comes from core.

Server: one handler, handleArchiveContentRecord(kind, id), behind POST /api/docs/<id>/archive and POST /api/decisions/<id>/archive. It calls Core.archiveContentRecord and maps the answer as handleArchiveTask does: 404 with CONTENT_RECORD_WORDS[kind].notFound, 409 ambiguous, 400 RecordRefusedError, 500 with archiveState moved, broadcast after a move. It returns {success: true} and no describeContentRecordChange lines: the page shows no success message and the web shows no list of tasks naming the file (task scope).

Core: moveContentRecord tags the commit failure of an archive with markRecordAlreadyMoved(failure, 'archiveState'). Restore and delete are not tagged; the web has no route for them.

Web: src/web/components/RecordArchive.tsx holds the hook and the three pieces (ArchiveButton, ArchivedLabel, ArchiveRefusal) for both pages; ARCHIVABLE_PAGES is the only per-kind table (list path, restore command, API call). A ref guards double submission, as state alone lets two clicks in one render through.

Header wrap (base change, both pages): found in the browser check. The metadata row never wrapped, so its full width was the title column's minimum and the header buttons were pushed past main, which has overflow-x hidden. With Archive beside Edit, Archive was cut off at a 920px window with the sidebar open (right edge 988) while Edit alone fitted. The header row now wraps (gap-x-6 replaces ml-6 on the buttons) and the metadata row wraps (gap-x-6 gap-y-2 replaces space-x-6). Measured: the header needs 380px of main width with Archive, against 562px for Edit alone before. Where everything fits on one line the page is unchanged.

Browser check (criterion 15), against a binary built from the branch in a mktemp project: 1280, 920 with the sidebar open, 768 and 375 wide; light and dark; Tab from the title reaches Archive with a focus ring and Enter archives (decision-1 left the sidebar, the page went to /decisions, commit 'backlog: Archive decision decision-1', R100). Refusal for doc-3 shows core's message; archived doc-2 and decision-2 by URL show the Archived label and no buttons; edit mode at 375 fits. The browser pane dismisses native dialogs on its own, so window.confirm was replaced by a function that records its text and answers yes; the native dialog's look was not seen. Screenshots: scratchpad/back-764/ (01 to 28). HTTP and CLI transcript: scratchpad/back-764/http-transcript.txt.

Review fixes. A: `?edit=true` opened the editor of an archived record (the document page then showed it without Save or Cancel). Both pages now keep the request in `editRequested` and derive `isEditing = editRequested && !isArchived`. A line in the loader (the reviewer's suggestion) would miss a URL that asks again while the record is open, because no new load runs; the page test shows it, failing on that second request. B: the alert for a record that moved while only the commit failed is now the task button's short sentence with the record noun; the Git error stays in the server log.

Repair verification (2026-10-16), source held stable for full-context review:
- Integrated exact repaired BACK-763 parent 27030c6a527a623cd08efeb8043651461d794ad2 (merge 59c74c23) and freshly verified origin/main 230b9e7e17548e068d73e6f041522f04008bf80a (merge dc0b70f3). Current main legacy-section safety and already-merged BACK-767 CI changes are preserved; local BACK-767 a017677fbb65daf954f9453b1320926d70604a25 is untouched. Modified-file attribution remains the original BACK-764 paths plus its repair; unrelated inherited main/parent paths are not attributed to this task.
- Both detail loaders now guard their request lifetime through success, fallback, error, and finally. Existing documentIdKey/decisionIdKey define route identity; only a loaded record matching that route can Archive. One shared archive hook owns submitted-route completions. A late refusal or moved-commit alert cannot affect the new route. Completed archives still refresh global lists; navigation rechecks route ownership after that refresh. A route-owned refusal replaces clear-on-record effects. Current-record behavior and header markup/copy are preserved.
- Deterministic controlled-promise React regressions: 54 archive cases pass; combined archive/ambiguous-ID/API/refresh/route suite98 passes. Covers both pages, late load success/not-found/cached-fallback/ambiguity while B loads or is loaded, wrong loaded ID, late archive refusal/success/moved-commit failure, route changes while global refresh waits, normalized aliases, new/read-only/editor states, unmount, and same-render double submission. Removed arbitrary timer flushes.
- Subtraction proof in isolated temporary source copies: removing loader guards causes14 failures; removing archive guards causes14; removing the post-refresh navigation guard causes8. Repository source did not change during subtraction or final architecture review. Evidence: /private/tmp/back-764-subtraction-cykpdmot.
- Broad inherited lifecycle/server/document/decision/Git/link/commit/error/atomic/publication/lock/legacy/instruction coverage:623 cases verified. Initial run622 passed and only the unchanged document interactive-viewer spacing assertion failed under NO_COLOR. Inspected it, then reran the affected file with env -u NO_COLOR TERM=xterm-256color:37/37 pass. Unchanged viewer suites also24/24 pass with that environment. Logs: /private/tmp/back-764-integration-tests.log, /private/tmp/back-764-doc-viewer-source.log, /private/tmp/back-764-viewer-tests.log.
- Canonical Bun1.4.3 type check, Biome2.5.15 check, and bytecode build pass. Compiled executable lifecycle plus inherited legacy-section regression coverage168 cases verified; the same single viewer environment assertion was corrected by the narrow37/37 proper-env rerun. Compiled MCP stdio smoke15 tool calls passes document archive/read-only/restore/delete/ID reuse and task archive/restore/delete/ID reuse. Logs: /private/tmp/back-764-compiled-cli-tests.log, /private/tmp/back-764-doc-viewer-compiled.log, /private/tmp/back-764-compiled-mcp-smoke.log.
- Current browser proof used the built executable in an isolated CLI-created temporary project: live document Archive/Edit controls and the native confirmation title, sidebar/search text, restore command, and confirm-dialog type were observed. Capturing the open native dialog stalled the provider; bounded recovery found the browser unavailable. Current manual cancel/success navigation was therefore not completed and is covered by deterministic React/server tests. Original width/theme/keyboard evidence carries because markup is unchanged; do not treat this as a fresh successful manual flow. Temporary browser provider disconnected; the temporary server was stopped.
- Full-context architecture review from the coordinator is KEEP with no blocker or added scope. Final task status, summary, repair commit, and push remain on hold for coordinator authorization.

Coordinator authorized finalization after stable KEEP review and completed checks, with the browser limitation above disclosed. Server81705 confirmed stopped; the browser provider is unavailable. Final reviewed source/test hashes and task modified-file attribution are unchanged. Final diff/type/Biome checks pass; the expected remote BACK-764 head59efc56bfa94c6a297115e1c6f5fdfdf1e656d80 and main230b9e7e17548e068d73e6f041522f04008bf80a were verified before protected publication.

Second route-repair round (PRRT_kwDOO2LIE86s_81P): confirmed prefix-only invalid IDs return null from existing identity keys. The first repair returned before reset/finally, introducing infinite loading on fresh links. Separate baseline loading probes4/4 pass on59efc56b anddc0b70f3, while2ec0e373 fails both fresh-link cases. Stale record retention during in-app invalid navigation also existed before this repair; it is not claimed as newly introduced.
The bounded fix moves the null check after shared loader resets inside try/finally, clears old title/path, and reuses the existing No document selected / No decision selected empty state for a non-new route with null identity. No new copy, markup, identity rule, loading layer, or HTTP behavior.
Four table-driven cases cover both pages for fresh deep links and in-app navigation, old content/Archive/Edit removal, and recovery to a valid record and the new editor. Full new expectations fail4/4 on2ec0e373 and pass4/4 after the fix. All58 archive tests and115 affected web/identity/API/route/refresh tests pass. Canonical types, Biome, build, and diff checks pass. Rebuilt executable smoke:12 CLI calls,12 HTTP checks including both invalid deep-link SPA routes and invalid record/archive API404s, and6 MCP lifecycle/read-only calls pass. Temporary HTTP/MCP subprocesses are stopped. Evidence: /private/tmp/back-764-invalid-route-proof-tgek4q_p, /private/tmp/back-764-invalid-route-web.log, /private/tmp/back-764-invalid-compiled-smoke.json. Earlier unrelated integration/legacy/viewer proof remains valid and was not broadly repeated.
Full-context final review is KEEP and the coordinator authorized finalization. Reviewed source/test hashes remain stable. Browser provider remains unavailable; there were no more browser retries. The prior material limitation remains: current controls/native confirmation observed, original width/theme/keyboard evidence carried for unchanged markup, fresh manual cancel/success navigation not completed after provider disconnect and covered by deterministic React/server tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The document and decision detail pages share one Archive flow: native confirmation, one request at a time, core refusal messages, global list refresh, and navigation after a completed archive. Archived records remain read-only. The server routes remain thin Core adapters and the web still has no delete or restore controls.

The repair ties loads and archive completions to the current normalized route identity using existing document/decision ID keys. Late load success, fallback, errors, and finally cannot replace a newer record or end its loading state. Archive receives only a loaded record matching the route. Late refusal/alert/navigation cannot affect another route, and navigation is checked again after the awaited global refresh. Completed old archives may still refresh app data. Original header markup and copy are preserved.

Verification:54 archive React cases and98 combined web cases pass;623 inherited integration cases verified after the one unchanged viewer environment case passes in its37-case rerun with env -u NO_COLOR TERM=xterm-256color;24 other viewer cases pass. Compiled CLI lifecycle and legacy-section coverage168 cases verified after the same narrow viewer rerun; compiled MCP stdio lifecycle smoke15 calls passes. Bun1.4.3 type check, Biome2.5.15 check, bytecode build, and diff checks pass. Subtraction proof in isolated copies produces14 loader-guard failures,14 archive-guard failures, and8 failures when the final navigation check is removed.

Current browser proof observed the built binary showing live Archive/Edit controls and the correct native confirmation. Capturing its open native dialog stalled and disconnected the browser provider. A fresh manual cancel/success navigation flow was not completed; deterministic React/server tests cover it. Original width/theme/keyboard evidence carries because markup is unchanged. Temporary resources are stopped.

The existing branch preserves the exact repaired BACK-763 parent and verified main230b9e7, including the separate BACK-768 legacy-section safety fix and already-merged BACK-767 workflow changes. Local BACK-767 remains untouched. Full-context final architecture review is KEEP. No PR merge, public comment, or review-thread resolution is part of this repair.

Second route repair: prefix-only invalid IDs now finish the existing loader reset/finally path, clear old record data, and show the existing No document selected / No decision selected state. Fresh-link infinite loading was introduced by the first repair; stale content after invalid in-app navigation also existed earlier. Four new cases fail on the previous head and pass with this bounded correction, including recovery to a valid route and new editor. All58 archive cases and115 affected web/identity/API/route/refresh cases pass. Canonical types/Biome/build/diff checks pass; rebuilt smoke12 CLI,12 HTTP, and6 MCP calls pass, with all temporary processes stopped. Earlier stack proof and the exact browser limitation above remain valid. Final contextual review is KEEP.
<!-- SECTION:FINAL_SUMMARY:END -->
