---
id: BACK-725
title: Keep a cleared default editor when init runs again
status: To Do
assignee: []
created_date: '2026-10-11 10:43'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1066'
type: bug
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog config set defaultEditor ""` is accepted and means no editor. That choice does not survive re-running `backlog init` in the same project: init writes the current shell's `$EDITOR` or `$VISUAL` back into the project config and exits 0 without mentioning the editor (issue #1066, reproduced on 1.53.0 and on main). The project config is usually committed, so a re-init by any contributor silently puts that contributor's editor into the shared config and undoes an explicit choice.

The issue observes that the cleared value is stored as an absent key, which makes it indistinguishable from never having chosen an editor, and that a hand-written empty `default_editor` value is overwritten the same way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After `backlog config set defaultEditor ""`, re-running `backlog init` in the same project with `$EDITOR` or `$VISUAL` set does not write an editor into the project config.
- [ ] #2 After that re-init, `backlog config get defaultEditor` reports no editor command.
- [ ] #3 Re-running `backlog init` in a project that has a configured editor keeps that editor.
- [ ] #4 A first `backlog init` in a new project still takes its default editor from `$EDITOR` or `$VISUAL` as it does today.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
