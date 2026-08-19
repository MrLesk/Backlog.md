---
id: BACK-588
title: Make the TUI help popup robust to resize and wrapped lines
status: Done
assignee:
  - '@codex'
created_date: '2026-08-07 20:45'
updated_date: '2026-08-10 05:36'
labels:
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
modified_files:
  - src/ui/components/help-popup.ts
  - src/ui/components/filter-popup.ts
  - src/test/help-popup.test.ts
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
- [x] #1 Resizing the terminal while the help popup is open reflows the popup to the new viewport; shrinking from 24 rows to 10 keeps the popup fully on-screen with its close/help rows visible
- [x] #2 After a resize the scroll bounds reflect the new size, so the last line of help content is still reachable and no content is stranded
- [x] #3 On narrow terminals where shortcut descriptions wrap, help content scrolls to its last line; verified with the full board shortcut set at 30x24
- [x] #4 Regression tests cover the resize-while-open case and the wrapped-description scroll case
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reflow the help popup with the existing popup chrome helper on initial render and every screen resize, measuring the scrollable viewport after rendering so wrapped lines and the current visible height define scroll state.
2. Clamp the current offset to the recomputed bounds, update the footer hint from the measured result, and remove the resize listener when the popup closes.
3. Add real-screen regression tests for a 24-to-10 row resize and the full board shortcut set at 30x24, including scrolling to the final rendered line.
4. Run focused tests, TypeScript, Biome, and the broader relevant suite; inspect and simplify the final diff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused createPopupChrome.reflow and the renderer's getScrollHeight result, so scroll bounds follow the exact post-tag, wrapped visual rows instead of logical shortcut count. Each initial layout and resize reparses content at the current width, clamps childBase to the new viewport, updates the scroll footer, and removes its resize listener on close.

Validation: 27 focused TUI/help tests passed; bunx tsc --noEmit passed; bun run check . passed across 369 files; bun run build passed; git diff --check passed. Independent read-only review found no P0-P2 gaps.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the TUI help popup reflow safely with terminal resizes and derive scrolling from actual wrapped renderer rows. Real-screen regressions prove a 24-to-10 row shrink remains fully visible and scrolls to the end, while the full board shortcut set at 30x24 reaches its final wrapped line. Verified with 27 focused tests, TypeScript, Biome, build, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
