---
id: BACK-577
title: Include the project name in TUI window titles
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/853'
priority: low
type: bug
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #853. TUI window titles do not identify which project is open, so users running several boards in parallel terminals cannot tell the windows apart. The board hardcodes "Backlog Board" (src/ui/board.ts:304) and the task viewer defaults to "Backlog Tasks" (src/ui/task-viewer-with-search.ts:321 and src/ui/task-viewer-with-search.ts:1014), while the overview TUI already renders `${projectName} - Overview` (src/ui/overview-tui.ts:39). The fix is to extend the existing overview pattern to the other two surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The board TUI title includes the project name, following the overview TUI pattern
- [ ] #2 The task viewer TUI title includes the project name, following the same pattern
- [ ] #3 Titles fall back to a sensible default when the project name is empty
- [ ] #4 The readyPattern "Backlog Board" in src/test/tui-interactive-editor-handoff.test.ts:409 is updated to match
- [ ] #5 Restoring the previous terminal title on exit is either included as a small addition or explicitly recorded as out of scope
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
