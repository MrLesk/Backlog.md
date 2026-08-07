---
id: BACK-588
title: Make the TUI help popup robust to resize and wrapped lines
status: To Do
assignee: []
created_date: '2026-08-07 20:45'
labels:
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
priority: medium
type: bug
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from Codex review of PR #833 (BACK-565, TUI task composer and board). Two help-popup findings were accepted as real but deferred to a follow-up.

The popup does not survive a terminal resize while it is open. If help is opened at a tall size and the terminal then shrinks below the computed popupHeight (for example 24 rows down to 10), the popup keeps its original height, centers at a negative top, and the close/help rows fall off-screen; the scroll math also stays stale (src/ui/components/help-popup.ts around line 75). The composer already reflows on resize; this surface does not.

The popup also mis-measures its own content on narrow terminals. Shortcut descriptions wrap, so the logical shortcut count understates the rendered height: at 30x24 the 17 board shortcuts render as 24 lines but maxScrollOffset computes 0, which clips the tail (help-popup.ts around line 104). Scroll limits need to follow rendered lines rather than logical entries.

In both cases the user ends up in a help popup whose last rows are unreachable, which is a dead end in the one surface meant to explain the keyboard model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Resizing the terminal while the help popup is open reflows the popup to the new viewport; shrinking from 24 rows to 10 keeps the popup fully on-screen with its close/help rows visible
- [ ] #2 After a resize the scroll bounds reflect the new size, so the last line of help content is still reachable and no content is stranded
- [ ] #3 On narrow terminals where shortcut descriptions wrap, help content scrolls to its last line; verified with the full board shortcut set at 30x24
- [ ] #4 Regression tests cover the resize-while-open case and the wrapped-description scroll case
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
