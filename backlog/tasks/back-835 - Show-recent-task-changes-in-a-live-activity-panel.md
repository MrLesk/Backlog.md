---
id: BACK-835
title: Show recent task changes in a live activity panel
status: To Do
assignee: []
created_date: '2026-11-23T20:54:00Z'
labels:
  - web
dependencies:
  - BACK-829
references:
  - src/server/index.ts
  - src/web/App.tsx
priority: low
type: feature
ordinal: 434000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents change tasks through the CLI while a person watches the board. The browser already updates in place when a file changes, but nothing says what changed: a person has to notice that a card moved, or open the task to see that a criterion was checked.

The reference the maintainer brought to the web redesign on 2026-11-23 has an assistant panel in which a person watches each change happen. The maintainer chose to take one thing from it: a panel that lists what changed, built as its own task after the redesign. A chat panel that drives an agent was ruled out.

The drawing shows a panel beside the content with the newest change first, grouped by time. Each entry names the task, what changed (a status change, a checked criterion, a section that was added or updated) and the assignee of the task, and opens the task. The row or card of a task that changed a moment ago is marked.

Backlog does not record who made a change, so the panel must not claim it. It can show the assignee as context.

When one server serves several projects (see the task for handling several projects from one Backlog instance), the panel should be able to show all of them or one, with the project on each entry. That part belongs to whichever of the two tasks is done second.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A control opens and closes an Activity panel beside the content, and the choice is remembered.
- [ ] #2 The panel lists changes to tasks that happen while the browser server runs, newest first and grouped by time: a task created or archived, a status change, acceptance criteria or Definition of Done items checked, and sections added or updated.
- [ ] #3 Each entry shows the task ID and title, what changed and the assignee of the task, and opens the task.
- [ ] #4 The panel never states who made a change unless the task data says so.
- [ ] #5 A task that changed in the last moments is marked in the list and on the board, and the mark does not animate when reduced motion is requested.
- [ ] #6 Nothing is written to task files, configuration or the repository to support the panel.
- [ ] #7 The panel is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone, and tests cover a status change, a checked criterion and a new task appearing in the panel.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
