---
id: BACK-831
title: Open task files in a viewer with an Open in editor action
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
updated_date: '2026-11-25T16:09:00Z'
labels:
  - web
dependencies:
  - BACK-830
references:
  - src/server/index.ts
  - src/web/components/TaskDetails.tsx
  - src/web/components/TaskFileList.tsx
priority: medium
type: feature
ordinal: 427000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task lists its references and modified files as plain text. To look at one, a person leaves the browser and finds the file by hand.

On 2026-11-23 the maintainer asked for these files to be clickable, opening in a read-only viewer borrowed from the Groma web UI, with a button that opens the file in the editor. Groma's viewer (`src/viewers/web/source/view.ts` and `highlight.ts` in the groma repository) shows the file path, a line count, numbered lines and light syntax coloring, one level deeper inside the pane it was opened from, with a Back button.

The drawing puts the viewer where the task text is and keeps the lists of references and modified files beside it, with the open file marked, so a person can step through a task's files without leaving the task.

Two things make this more than a display change. The browser server is local and has no authentication, so serving file contents and starting an editor are new things a request can ask for. Both must stay inside the request validation added by BACK-806 and inside the project folder. And an editor started by the server has no terminal, so a terminal editor such as vim cannot be opened this way.

To settle with the maintainer at plan review: whether the server may read any file under the project root or only files that a task names; what the editor button does when the configured editor needs a terminal; and whether the remote-access warning for `--host` has to say that file contents become readable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On the task page, a reference or modified file that is a path inside the project opens in a read-only viewer in place of the task text, with the path, the line count, numbered lines and syntax coloring. Back returns to the task. A reference that is a URL opens in a new tab.
- [ ] #2 The lists of references and modified files stay visible beside the viewer, mark the open file, and switch the viewer when another file is chosen.
- [ ] #3 The server returns file contents only for paths that resolve inside the project root after symbolic links and parent segments are resolved, and refuses anything else with a clear error.
- [ ] #4 A file that is missing in this checkout, is binary, or is larger than a stated limit shows a message in the viewer instead of content.
- [ ] #5 Open in editor, on the viewer and on each file row, opens the file with the editor the CLI would use. When that editor cannot be started from the server, the page says why and offers the path to copy, the request does not hang, and no process is left behind.
- [ ] #6 The document and decision pages offer the same Open in editor action for the record file itself.
- [ ] #7 The file and editor requests pass the browser request validation from BACK-806, and tests cover path traversal, a symbolic link that leaves the project, and a cross-site request.
- [ ] #8 The viewer is checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
