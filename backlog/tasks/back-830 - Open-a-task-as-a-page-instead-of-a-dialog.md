---
id: BACK-830
title: Open a task as a page instead of a dialog
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - web
dependencies:
  - BACK-829
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
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
- [ ] #1 Opening a task shows it as a page in the content panel with a breadcrumb back to Tasks, the title, the sections in the order the dialog uses today in a reading column, and a Properties column with status, priority, assignee, type, labels, project, milestone, dependencies, branch, created and updated.
- [ ] #2 Everything the dialog does today still works on the page: changing properties in place, edit mode with save and cancel and their keyboard shortcuts, checking acceptance criteria and Definition of Done items, adding references and modified files, comments, demote to draft and archive.
- [ ] #3 A task from another branch shows the read-only notice and cannot be changed, as today.
- [ ] #4 Closing the page with the close button, the Escape key outside edit mode or the browser Back button returns to the list or board the person came from, with its layout and filters. A task opened from a direct link closes to the Tasks page.
- [ ] #5 Existing task links keep opening the task, and a link that is not valid still shows the existing message.
- [ ] #6 The page follows changes to the task file while it is open, as the dialog does.
- [ ] #7 Creating a task or a draft works as it does today.
- [ ] #8 The page is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone.
- [ ] #9 Tests cover opening and closing with the return to the previous view, saving an edit, and the read-only state.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
