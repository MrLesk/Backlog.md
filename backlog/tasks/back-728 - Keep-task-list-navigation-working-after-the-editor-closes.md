---
id: BACK-728
title: Keep task list navigation working after the editor closes
status: To Do
assignee: []
created_date: '2026-10-11 10:43'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1070'
type: bug
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the interactive `backlog task list`, pressing `E` opens the selected task in the editor. After the editor is closed, the list stops responding to navigation: j, k, and the arrow keys do not move the selection and clicking a row does not select it, while search, the filters, and the other hotkeys keep working (issue #1070, 1.53.0 on macOS; the same in Warp, Terminal.app, and iTerm2, with vim and nvim).

The reporter's workaround is to open search with `/` and leave it, after which navigation works again. That suggests the list does not get keyboard focus back when the editor closes, which is a lead to verify, not a confirmed cause.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In the interactive `backlog task list`, after opening a task in the editor with `E` and quitting the editor, j, k, and the arrow keys move the selection again without any workaround.
- [ ] #2 After the editor closes, clicking a row with the mouse selects it again.
- [ ] #3 Navigation keeps working when the edit cycle is repeated several times in one session.
- [ ] #4 Search, the filters, and the other hotkeys keep working after the editor closes, as they do today.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
