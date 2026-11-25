---
id: BACK-830
title: Open a task as a page instead of a dialog
status: Done
assignee:
  - '@claude'
created_date: '2026-11-23T20:53:00Z'
updated_date: '2026-11-25T18:48:00Z'
labels:
  - web
dependencies:
  - BACK-829
references:
  - src/web/components/TaskDetails.tsx
  - src/web/components/TaskPageLayout.tsx
  - src/web/lib/task-links.ts
  - src/web/App.tsx
  - task-details
modified_files:
  - src/web/lib/task-links.ts
  - src/web/components/TaskLink.tsx
  - src/web/App.tsx
  - src/web/components/Layout.tsx
  - src/web/components/TaskPageLayout.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/TaskDetails.tsx
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/components/ActionsMenu.tsx
  - src/web/components/TaskColumn.tsx
  - src/web/components/TaskFileList.tsx
  - src/web/components/ChipInput.tsx
  - src/web/components/DependencyInput.tsx
  - src/web/components/DependencyGraphSection.tsx
  - src/web/components/AcceptanceCriteriaEditor.tsx
  - src/web/components/Modal.tsx
  - src/web/components/SubtaskTree.tsx
  - src/web/components/SubtaskControls.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/MilestoneTaskRow.tsx
  - src/web/components/MilestonesPage.tsx
  - src/web/components/Statistics.tsx
  - src/web/components/DraftsList.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/utils/task-id-links.ts
  - src/web/components/MermaidMarkdown.tsx
  - src/web/styles/source.css
  - src/test/web-task-details-modal-acceptance-criteria.test.tsx
  - src/test/web-task-details-acceptance-criteria.test.tsx
  - src/test/web-task-details-modal-default-assignee.test.tsx
  - src/test/web-task-details-default-assignee.test.tsx
  - src/test/web-task-details-modal-demote.test.tsx
  - src/test/web-task-details-demote.test.tsx
  - src/test/web-task-details-modal-documentation.test.tsx
  - src/test/web-task-details-documentation.test.tsx
  - src/test/web-task-details-modal-final-summary.test.tsx
  - src/test/web-task-details-final-summary.test.tsx
  - src/test/web-task-details-modal-keyboard-shortcuts.test.tsx
  - src/test/web-task-details-keyboard-shortcuts.test.tsx
  - src/test/web-task-details-modal-modified-files.test.tsx
  - src/test/web-task-details-modified-files.test.tsx
  - src/test/web-task-details-modal-subtasks.test.tsx
  - src/test/web-task-details-subtasks.test.tsx
  - src/test/web-task-details-modal-unsaved-navigation.test.tsx
  - src/test/web-task-details-unsaved-navigation.test.tsx
  - src/test/readiness.test.tsx
  - src/test/web-dependency-graph-section.test.tsx
  - src/test/web-dependency-picker-local-only.test.tsx
  - src/test/web-draft-editing.test.tsx
  - src/test/web-task-project.test.tsx
  - src/test/web-task-readiness-badge.test.tsx
  - src/test/web-task-types.test.tsx
  - src/test/web-task-acceptance-progress.test.tsx
  - src/test/web-task-card-dates.test.tsx
  - src/test/web-board-batch-move.test.tsx
  - src/test/web-board-drag-hidden-columns.test.tsx
  - src/test/web-task-column-sort.test.tsx
  - src/test/mermaid-markdown.test.tsx
  - src/test/web-tasks-page.test.tsx
  - src/test/web-nested-tasks.test.tsx
  - src/test/web-app-open-detail-refresh.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
  - src/test/web-milestones-page-unassigned-filter.test.tsx
  - src/test/web-milestones-page-search.test.tsx
  - src/test/web-dependency-input-links.test.tsx
  - src/test/web-dependency-cleanup-notice.test.tsx
  - src/web/lib/task-nesting.ts
  - src/test/web-task-links.test.ts
  - src/web/contexts/AddressBarLocationContext.tsx
  - src/web/components/TasksPage.tsx
  - src/web/components/Board.tsx
  - src/test/web-side-navigation-loading.test.tsx
  - src/test/readiness-surface-agreement.test.ts
  - src/test/web-statistics-task-links.test.tsx
  - groma/systems/backlog-md/containers/web-ui/components/task-details.md
  - src/web/lib/app-pages.ts
priority: medium
type: enhancement
ordinal: 426000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task opens in a dialog of fixed width over the board or the list. Its content is several screens tall, so the plan, the notes and the final summary sit far below the fold of a scrolling box, and the properties share that box. This is the main place where a person reviews what an agent intends to do and what it did, and a dialog is a poor surface for reading.

The web redesign approved by the maintainer on 2026-11-23 shows a task as a page inside the content panel: a breadcrumb, the title, the sections in a reading column, and the properties in a column beside it. The task routes already exist (`/tasks/:id/:title` and `/board/:id/:title`); today they open the dialog over the page behind it.

This slice follows the Tasks page slice. It does not change what a task contains or how it is edited.

Related: BACK-599 covers task links that lose the list a person came from. BACK-417 and BACK-420 ask for more room and an outline for long task content. They are separate tasks, and this one must not make them harder.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a task shows it as a page in the content panel, over the page it was opened from (the Tasks page in its layout and with the filters of the URL for the list, the board or a direct link): a breadcrumb that links to that page, the title, the sections in the order the dialog uses today in a reading column, and beside it a Properties panel (status, priority, assignee, type, labels, project when configured, milestone, due date, parent, dependencies with the readiness verdict, branch for a task from another branch, created and updated) followed by References, Modified files and Documentation panels.
- [x] #2 Every place that opens a task is a real link to the task route, built by one function: List rows, Board cards, subtask rows in the List, in a card and on the task page, parent links and the Parent row, dependency links, Markdown task links, sidebar search results, and the task rows of Milestones, Statistics and Drafts. A link keeps the Tasks page's query and where the person came from, and a link followed from an open task replaces it.
- [x] #3 A task link behaves like a browser link: a plain click opens the task in the app, and Ctrl/Cmd-click, middle-click and the link's context menu open it in a new tab. On the Board, Ctrl/Cmd/Shift-click and Ctrl/Cmd/Shift+Enter keep selecting cards, a middle-click or the context menu opens a new tab, and a drag that starts on a card's title still moves the card.
- [x] #4 Closing the page with the close button, the Escape key outside edit mode or the browser Back button returns to where the person came from: the list or board with its layout, filters, scroll position and open groups, or the Milestones, Statistics, Drafts or other page the task was opened from. A task opened from a direct link closes to the Tasks page.
- [x] #5 Everything the dialog does today still works on the page: changing properties in place, edit mode with save and cancel and their keyboard shortcuts, checking acceptance criteria and Definition of Done items, adding and removing references and modified files, comments, and demote to draft and archive from a More actions menu.
- [x] #6 The title changes only in edit mode: the heading turns into a text field after Edit and is saved with Save or undone with Cancel, together with the other edited fields.
- [x] #7 While a task has unsaved edits, every way out of it except the browser's Back and Forward (the close button, the breadcrumb, task links on the page and links outside it such as the sidebar) asks before discarding them.
- [x] #8 A task from another branch shows the read-only notice and cannot be changed, as today.
- [x] #9 Existing task links keep opening the task, and a link that is not valid still shows the existing message.
- [x] #10 The page follows changes to the task file while it is open, as the dialog does.
- [x] #11 Creating a task or a draft works as it does today, in a dialog.
- [x] #12 The page is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone.
- [x] #13 Tests cover opening and closing with the return to the previous view, the link targets and the selection and new-tab rules, saving an edit, leaving with unsaved edits, and the read-only state.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decided on 2026-11-25 (maintainer: A, B, C; coordinator rulings within scope: D, E, the Board's new-tab rule and the card drag). Built on BACK-222, merged as 1dd7b5e2.

Decisions
- A. Every place that opens a task is a real link to the task route, built by one function, keeping the Tasks page's query and where the person came from (the history state handleOpenTask uses). This covers item 2 of BACK-599.
- B. The title changes only in edit mode: the heading becomes a text field after Edit, saved with Save and undone with Cancel. The in-place Title field goes.
- C. References, Modified files and Documentation are panels in the side column under Properties, as drawn.
- D. Demote to draft and Archive sit in a More actions menu; the board's column menu becomes one shared component that both use.
- E. Creating a task or a draft stays a dialog; Modal's frame moves to the tokens here, the content of the other dialogs stays with BACK-837.
- New tab: task links behave like browser links. On the Board, Ctrl/Cmd/Shift-click and Ctrl/Cmd/Shift+Enter keep selecting cards; a middle-click or the context menu opens a new tab. A card's title link is draggable={false}, so the card stays the drag source.

Flows this extends
- Task routes /tasks/:id[/:title] and /board/:id[/:title]: unchanged. They render the Tasks page in its layout and App shows the task over it, now as a page in the content panel instead of a dialog.
- handleOpenTask and the links of DependencyInput and the sidebar search: their rule becomes the one link function. A link from a page pushes the task route (in the layout of the Tasks page with its query, or in the remembered layout from any other page) and records that page as the page beneath; from an open task it replaces the route and keeps the same page beneath. Every task, draft included, opens through its route: the dialog's second path for pages without a task route goes.
- The page beneath: App renders the pages with the location of the page beneath an open task (Routes location), so that page, whichever it is (Tasks, Milestones, Statistics, Drafts, documents, decisions, settings), stays mounted and inert under the task and keeps its search, open groups, scroll position and focus. Layout's pagePath and the sidebar's current item follow it; the breadcrumb names it. A direct link or a new tab has no page beneath in its history state and gets the Tasks page of the route's layout.
- Closing: today's handleCloseModal, renamed: back in history to the page beneath when the task was opened in this tab, else to the Tasks page beneath in place of the task (a direct link). Back pops the task route and the route effect closes the page.
- Edit mode (E, Save, Cancel, Cmd/Ctrl+S, Escape cancels, the newer-version notice), the read-only rule and its notice, live updates through App's detail reader, creating a task or draft, demote and archive with their confirmations and failure messages: same code paths.
- No-op guards: selects write only on a change, chips and references add only new values, a toggle changes one item. Save had none (it sent the form when nothing changed and core then wrote nothing): with nothing changed it now leaves edit mode without a request.

1. Structure (src/web)
- lib/task-links.ts (new): taskLinkTarget(task, location), the one rule for where a task link goes and what history state it carries, and the task route state type and reader.
- components/TaskLink.tsx (new): TaskLink, a router link to a task built with taskLinkTarget, and useOpenTask for the mouse shortcuts that open a task without a link (a click elsewhere on a row or card, the legacy highlight link). App's handleOpenTask is useOpenTask.
- components/TaskDetailsModal.tsx becomes components/TaskDetails.tsx (git mv): still the one owner of a task's form state, edits and writes. It shows an existing task or draft as the task page and a new one in the create dialog, and is mounted only while it shows something, so isOpen and its open and closed bookkeeping go. Repeated blocks become local pieces: one Markdown section, one checklist, one property row.
- components/TaskPageLayout.tsx (new): the page around a task, without task logic: a head row (breadcrumb, actions, close) that stays in place while the body scrolls, notices, the heading, a reading column and a side column; TaskSection and TaskPanel for the sections and side panels. Escape outside edit mode closes the page here. It focuses the page when it opens and when another task opens in it.
- components/TaskFileList.tsx (new): one panel for References, Modified files and Documentation (file or link icon, mono path, remove and add while the task can be changed). BACK-831 adds its viewer to these rows.
- components/ActionsMenu.tsx (new): the menu button and list of TaskColumn, used by TaskColumn and the page.
- Layout.tsx: a taskPage prop. main holds the current page and, while a task is open, the task page on top of it, below the header row. The current page stays mounted and inert, so its scroll position, open groups and lanes, opened subtask levels and board selection are as they were when the task closes. The layer remembers what had focus when it opened and returns focus there when it closes. The scroll container moves from main into its first child.
- App.tsx: the modal state becomes the task view: closed, create (the dialog) or page (the task the route names). While a page's first read is pending it shows its head over an empty body, so moving between tasks, Back and Forward never show the list in between. Names that say modal (TaskModalState, handleCloseModal, clearTaskModal, showModal, the history key taskModalFrom) are renamed for the page.
- Links in: TaskList rows (title and parent link), TaskCard (title, parent link), SubtaskTree rows (List trees are TaskList rows; card and page trees), the Parent row, DependencyInput chips, DependencyGraphSection nodes, Markdown task links (the remark plugin marks them, MermaidMarkdown renders them as TaskLink), SideNavigation search results, MilestoneTaskRow, Statistics task previews and DraftsList rows. Rows and cards keep their mouse shortcut for a plain click elsewhere on them.
- SubtaskTree: showsCriteria becomes variant "card" | "page"; the page variant has 38 px rows, hairline dividers, 13.5 px medium titles and each row's criteria ring, in a bordered box.
- AcceptanceCriteriaProgress: its ring becomes ProgressRing, which the section captions use too.
- styles/source.css: the Markdown preview and editor inside the task view read the tokens (scoped), so documents and decisions keep their look until BACK-832 and BACK-833.
- ChipInput, DependencyInput, AcceptanceCriteriaEditor and DependencyGraphSection (used only by the task view) and Modal's frame move to the tokens.
- SideNavigation: Create document becomes a link, so the unsaved-edits guard covers it.

2. Keys and unsaved edits
- E, Cmd/Ctrl+S and Escape act only while focus is in the page, so the sidebar, its search and the drawer keep their keys; Escape goes first to an open list or menu. The page is not modal: Cmd/Ctrl+K opens the sidebar search and Tab continues into the header and sidebar.
- "Discard unsaved changes and leave this task?" covers every way out: the close button (in edit mode it asks instead of being disabled), the row shortcut of a subtask tree, and any link in the window, including the breadcrumb, task links and the sidebar, through one document-level link guard that replaces the dialog-only one. Browser Back and Forward do not ask, as today.

3. Look: the approved drawing on the BACK-828 tokens, no raw gray, blue, amber or emerald utility left in the task view
- Head row: breadcrumb (the Tasks link in ink-2, the ID in mono ink), Edit, More actions and Close; in edit mode Cancel and Save. The header row above stays as BACK-829 ruled, so the drawing's project crumb is not repeated.
- panel-gutter for head and body, as on the Tasks page (point 5). Two columns from about 800 px of page width (reading column up to 780 px, text up to 72ch, side column 280 to 340 px); below that one column with the side column after the sections, as in the dialog.
- Reading column: the read-only note as drawn, the title (24 px semibold; the ID is in the breadcrumb, so no em dash), then Description, Subtasks, Acceptance criteria, Definition of Done, Dependency graph, Implementation plan, Implementation notes, Comments and Final summary under mono captions, with progress rings on the checklists and Subtasks. The "Toggle to update" and "Completion summary" hints go.
- Side column: Properties (Status, Priority, Assignee, Type, Labels, Project when configured, Milestone, Due, Parent, Dependencies with the readiness verdict, Branch, Created, Updated), drawn as in the drawing with the native select over each choice and quiet chip and dependency fields, so every property still changes in place; a task that cannot be changed shows text, which replaces the static export's summary line. Then the References, Modified files and Documentation panels.
- Left out from the drawing: Add subtask and the Blocked chips (BACK-222), the open-in-editor buttons (BACK-831), the Edit button on a read-only task. A contrast table records every new text and mark pair in both themes.

4. Related tasks
- BACK-599: item 2 (lost return route) is covered by the link function; item 1 stays open. A note goes to BACK-599.
- BACK-417 and BACK-420: the page body is one scroll container and the reading column's width is set in one place.
- BACK-831: the file panels sit beside the reading column in TaskFileList.

5. Tests (jsdom files run in the serial DOM pass)
- New: the link targets from the Tasks page, an open task, Milestones and a document; the Board's selection and new-tab rules on a card's title link, and the title link is not draggable; the Tasks page under an open task is inert and keeps its state; the page stays on screen while the next task loads; the breadcrumb returns to the filtered list; a task opened from Milestones closes back to Milestones; Cmd/Ctrl+K reaches the sidebar search while a task is open; a link outside the task asks before leaving unsaved edits and the close button asks in edit mode; keys pressed outside the page leave the task alone; Escape in More actions closes only the menu; Save with nothing changed sends no request; the title is edited only in edit mode.
- Changed: the dialog selectors become the page's; tests that render cards, rows and trees get a router for their links; Demote and Archive go through More actions; the dialog test files render TaskDetails. Removed: "does not fetch dependency tasks while the modal is closed".

6. Verification
- bun run check:types, bun run check, focused web tests, the full suite through scripts/run-ci-tests.ts with the CI flags, bun run build and scripts/smoke-compiled-build.ts.
- The compiled binary on a temporary project outside the repository, headless Chrome, light and dark, 1440, 1280, 768 and 390 px: open from every link place and a direct link; close with the button, the breadcrumb, Escape and Back with layout, filters, scroll position, open groups and focus kept; middle-click and Ctrl/Cmd-click; Board selection and real drops from a card's title link and from a tree row; edit and save with the shortcuts; read-only; a file changed with the CLI while open; create a task and a draft; demote and archive; a sidebar link with unsaved edits; the static export; a keyboard-only pass.
- codehygiene on the changed files, a cold simplicity review and a final complexity review.

Review round (2026-11-25, design and code reviews)
- The page beneath stays mounted for every page a task is opened from, not only the Tasks page (see the page beneath above). One function, pageBeneath in src/web/lib/task-links.ts, serves the links, the breadcrumb, closing and the fallback of a task that cannot be opened. Task links read the address bar's location (AddressBarLocationContext), because inside the routes useLocation() names the page beneath.
- Two columns from a 36rem container, with the properties at 240 to 340 px, so a 1024 px window with the sidebar open keeps them side by side.
- Focus: More actions returns focus to its button before an action runs, and the page puts focus dropped to the document body back on itself whenever its content changes.
- The 72-character measure applies to the Markdown text itself; the dependency field's open suggestions take their Escape; rows and cards ignore clicks on any link inside them.
- Names and wording: onOpenTask for every open handler, one accessible name for task links (taskLinkLabel), the card's own keys documented.
- Look: the checklists' box drawn from the tokens in both themes, the branch icon only on the branch notice, framed property fields in the create dialog, the title field with the heading's type, a shorter dependency placeholder, readiness marks in the verdict's color, one compact-control class for the 26 px controls, divide-y in the page's subtask tree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
How it fits together
- One link rule: src/web/lib/task-links.ts. taskLinkTarget(task, location) builds every task link (List rows, Board cards, subtask trees, parent links and the Parent row, dependency chips and graph nodes, Markdown task links, sidebar search results, Milestones, Statistics and Drafts rows). A link from a page records that page in the history state as the page beneath (background); a link from an open task replaces it and keeps the same page beneath. pageBeneath(location) is the one answer to "what is under this task": the recorded page, or for a task opened from outside the app (a typed or shared link, a new tab) the Tasks page of the route's layout with its query. The links, the breadcrumb, closing and the fallback of a task that cannot be opened all use it. taskLinkLabel gives every task link the same accessible name. taskRouteOf(pathname) is the one test of whether a task is open, used by App and by the links.
- contexts/AddressBarLocationContext.tsx: App renders its routes with the location of the page beneath an open task, so inside them useLocation(), useSearchParams() and a relative navigate() act on that page. A page beneath a task therefore must not navigate: the Tasks page checks useAddressBarLocation() and tidies the spelling of its query only once it is the page again. Task links and the drawer read useAddressBarLocation() too. The ?edit=true cleanup of documents and decisions runs only when such a page is arrived at, never beneath a task, because the page a task was opened from is recorded after that cleanup.
- components/TaskLink.tsx: TaskLink renders the link target; useOpenTask is the same navigation for the shortcuts that are not links; isTaskOpeningClick is the one rule for those shortcuts (a plain click that is not on a link).
- App.tsx: the task view is closed, the create dialog, or the page the route names. pageLocation (the page beneath while a task is open) is what the routes render and what Layout's pagePath and the sidebar's current item follow, so the page a task was opened from stays mounted and keeps its state. The route effect opens a page session; while the first read is pending App draws TaskPageLayout with its head only. TaskDetails is keyed by the task ID. closeTaskPage goes back one step in history to the page beneath, or replaces the task with the Tasks page beneath for a task opened from outside the app; clearTaskView only clears the state.
- Layout.tsx: TaskPageLayer holds the page over the page beneath, which is inert, and returns focus to whatever opened the task.
- TaskPageLayout.tsx: head row (breadcrumb naming the page beneath from lib/app-pages.ts, the same names the sidebar uses; actions; close), Escape closes unless a control inside handled the key (preventDefault), focus on open, and focus that a removed control of the page dropped to the document body comes back to the page; focus the person moved out of the page stays there. TaskColumns: two columns from a 36rem container, properties 260 to 340 px.
- TaskDetails.tsx (renamed from TaskDetailsModal.tsx): the page, or the create dialog when there is no task, where the list of properties carries data-framed-fields and every property field shows its frame. Title only in edit mode, with the heading's type; Demote to draft and Archive in More actions (ActionsMenu, shared with TaskColumn, returns focus to its button before an action runs); Properties, then the References, Modified files and Documentation panels (TaskFileList); one question before leaving unsaved edits, asked by the close button, the subtask row shortcut and a document-level link guard.
- styles/source.css: compact-control (the 26 px controls), property-field (the field of a property: negative margin, padding, quiet frame, framed in the create dialog), checkbox (the checklist box in both themes, dimmed when disabled) and the 72-character measure of the task's Markdown text.

Choices made during implementation
- Drafts open through /tasks/DRAFT-x or /board/DRAFT-x; the server resolves DRAFT IDs.
- A task opened from another page has its address in the layout used last (/board or /tasks), while that page stays beneath it.
- On a Board card, Enter on the title is left to the link and Space opens the task too; with Ctrl/Cmd/Shift both select the card. The card is a selectable item with keys of its own; links elsewhere leave their keys to the browser.
- In edit mode the close button asks before discarding instead of being disabled.
- Save with nothing changed leaves edit mode without a request.
- Sidebar search results and dependency graph links follow the one rule, so from an open task they replace it.
- A Ctrl/Cmd-click on a List row or a page subtask row outside its link does nothing; the link opens a new tab.
- The heading shows the form's title, so it changes as soon as Save succeeds.
- Statistics' task previews are module-level components, so a render of that page keeps their links and closing a task returns focus to the one that opened it.

Known limits and possible follow-ups
- Escape typed outside the page while it is open (in the sidebar search, say) still reaches the Board's document listener, which clears a Board selection under the page (the Board's existing rule: Escape anywhere clears the selection).
- The title field is one line: a title that wraps as a heading becomes one scrolling line in edit mode, so the sections below it move up by the extra lines.
- The new files (TaskDetails.tsx, TaskPageLayout.tsx, TaskLink.tsx, ActionsMenu.tsx, TaskFileList.tsx, lib/task-links.ts, contexts/AddressBarLocationContext.tsx) have no groma owner yet: giving them one needs a groma scan, and the scan stops responding in this environment (its TypeScript scanner process waits without using CPU; processes left by earlier scans in other worktrees show the same). The task-details record no longer names the deleted TaskDetailsModal.tsx and describes the page.

Reviews
- Cold simplicity review: tests that still drove the dialog were ported, focus lost after Save or Cancel was fixed, and the click rule, the boolean history flag, the shared Tasks-page path and the per-task key were simplified.
- Final complexity review: no blocking findings; the obsolete type request counter and three comments were cleaned up.
- Design and code reviews, first round (2026-11-25): the page a task is opened from stays mounted beneath it (Milestones lost its search, its open list, its scroll and focus), two columns at 1024 px with the sidebar open, focus after a cancelled More actions item, the 72-character measure of Markdown text, tests for the new-tab rule outside the Board, a vacuous Ctrl+S check and the race test's close step, the Escape of the dependency suggestions, the link-click rule, names, checkboxes, notices, the create dialog's fields, the title field and the shared classes. All applied; see the review round in the plan.
- Second round (2026-11-25): a direct task link with a query the Tasks page tidies closed the task (the page beneath wrote the address bar); disabled checkboxes looked live; the focus rule took focus the person had moved out of the page; the title field stuck out of the narrow gutter; the properties column at 240 px; the field frame written four times; the page names written twice; two tests of whether a task is open; the two focus comments. All applied.

Verification
- bun run check:types, bun run check, the full suite through scripts/run-ci-tests.ts with the CI flags (3146 pass in the parallel pass, 455 pass in the serial DOM pass, 0 fail), bun run build and scripts/smoke-compiled-build.ts on dist/backlog.
- Regression tests shown failing before their fix and passing after: the Milestones round trip (search, open list and focus kept), More actions focus after a cancelled action, the dependency suggestions taking their Escape, Statistics keeping its task links through a render, the new-tab rule on List rows and page subtask rows, direct task links with a query the Tasks page tidies (/tasks/ID?labels=a,b, /board/ID/x?status=to%20do, /board/ID?priority=HIGH) staying open, and focus left where the person moved it when the page changes.
- Second round in Chrome: direct links with labels=bug,docs, status=to%20do, type=story, type=Feature and priority=HIGH stay open on /tasks and /board, and closing one tidies the query of the Tasks page (/tasks?label=bug&label=docs); disabled checkboxes of an archived task dimmed in light and dark with a not-allowed cursor; after focus left the page, a CLI edit updated it without taking focus, and Escape left the task open; the title field at 390 px in edit mode keeps its text in place with no sideways scroll; the properties column is 260 px at 640, 700, 1024 and 1080 px, with the status, the dates and the labels on one line each; every field of the create dialog lines up at 1440 and 768 px.
- The compiled binary on a temporary project in headless Chrome:
  - Milestones: typed "Filler", Show all, scrolled 600 px, opened a task (breadcrumb "Milestones", sidebar on Milestones) and closed it: search, open list, scroll 600 and focus on the row all kept. Statistics: scroll and the same page kept, focus back on the link. Drafts: breadcrumb "Drafts > DRAFT-1", sidebar on Drafts, focus back on the row.
  - Two columns at 1024, 1100, 1155 and 1280 px with the sidebar open and collapsed (properties 240 to 327 px) and at 768 px; one column at 390 px; no horizontal overflow.
  - More actions: after cancelling Archive and Demote to draft, focus is on the menu button.
  - The description and the checklists end at the same 72-character measure (668 px at 1920 px).
  - Keyboard only from a filtered list: Enter opens, E edits, Tab to the title, Cmd+S saves with focus kept on the page, Escape closes to the filtered list with focus on the row link.
  - Light and dark screenshots of the task page, the checklists, the create dialog with framed fields, the archived and branch notices and the narrow layouts.
- Earlier in the task, unchanged by this round and checked again where touched: real clicks, modifier clicks, middle-click and drags on List rows, Board cards and subtask rows; edit, save, live CLI edits, create, demote, archive, read-only branch tasks and the static export.

Contrast, WCAG ratio of the text and mark pairs the page uses (light / dark)
- ink on surface: 13.51 / 14.84
- ink-2 on surface: 6.75 / 8.92
- ink-3 on surface (also the outline of an unchecked box): 5.77 / 5.97
- accent-text on surface: 5.76 / 9.60
- blocked on surface: 6.54 / 7.37
- ink on surface-2: 11.90 / 13.33
- ink-2 on surface-2: 5.94 / 8.01
- ink-3 on surface-2: 5.08 / 5.36
- ink on hover: 11.59 / 12.07
- you on you-bg: 5.71 / 8.36
- blocked on blocked-bg: 5.46 / 6.79
- on-ink on ink (the Save button and a checked box): 13.51 / 15.91
- ink-3 on paper: 5.27 / 6.40
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A task now opens as a page in the content panel, over the page it was opened from, instead of a dialog. That page (the Tasks page in its layout and with its filters, or Milestones, Statistics, Drafts, documents and the rest) stays mounted and inert beneath the task, so closing the task returns to it with its search, open groups, scroll position and focus as they were; a task opened from a direct link has the Tasks page beneath it, and that page leaves the address bar alone while the task is open, so a link whose query it would tidy stays open. The page has a breadcrumb naming the page beneath, the title, the sections in a reading column, and beside it Properties followed by References, Modified files and Documentation panels, in two columns down to a 1024 px window with the sidebar open. Every place that opens a task is a real link built by one rule (src/web/lib/task-links.ts), so Ctrl/Cmd-click, middle-click and the context menu open new tabs. The title changes only in edit mode; Demote to draft and Archive moved into a More actions menu shared with the Board's column menu; creating a task or a draft stays a dialog, with framed fields. Unsaved edits are guarded on every way out except browser Back and Forward, and Save with nothing changed sends no request.

Verified with types, Biome, the full suite through the CI runner, the build and the compiled smoke test, regression tests shown failing before their fixes, and the compiled binary in headless Chrome: direct links with untidy queries, the Milestones, Statistics and Drafts round trips, light and dark at the widths of both reviews, disabled checkboxes, focus after live updates, real clicks, drags and modifier clicks, a keyboard-only pass, live CLI edits, create, demote, archive, read-only branch tasks and the static export. The findings of both review rounds of 2026-11-25 are applied.

Follow-ups, not done: Escape typed outside the page can still clear a Board selection under it through the Board's own Escape rule; a title that wraps as a heading becomes one scrolling line in edit mode; the new files have no groma owner yet because the groma scan stops responding in this environment (the task-details record itself is updated).
<!-- SECTION:FINAL_SUMMARY:END -->
