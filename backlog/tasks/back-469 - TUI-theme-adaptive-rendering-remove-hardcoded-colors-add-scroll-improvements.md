---
id: BACK-469
title: 'TUI theme-adaptive rendering: remove hardcoded colors, add scroll improvements'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-21 08:42'
updated_date: '2026-06-07 19:42'
labels:
  - ui
  - board
  - ux
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Comprehensive TUI improvement for terminal theme compatibility and quality of life.

**Theme-adaptive colors (inverse video):**
- Remove all hardcoded `fg: "white"` and `bg: "black"` from screen/container elements across the TUI
- Switch all highlight/selection styling to `inverse: true` + `bold: true` instead of named ANSI colors — works on any terminal theme including monochrome palettes (e.g. Ghostty Retro)
- Board active highlight: inverse + bold; move mode: inverse + cyan bg
- Filter header focus/blur: inverse + bold instead of hardcoded blue/cyan/black
- Generic list selected rows: inverse + bold instead of bg: blue
- Filter popups (status/priority/milestone single-select + label multi-select): selected option and hover use inverse + bold instead of bg: blue/fg: white, so the highlight is visible on any theme
- Esc button on popups: inverse + bold
- Change semantic "white" to "gray" for status icons (To Do), heading level 3, and priority fallback
- Code path highlighting changed from gray to cyan for better visibility across themes
- Filter header blur handlers clear inverse/bold instead of forcing black/white

**Scroll improvements:**
- Added PGUP/PGDN/Home/End keybindings to standalone scrollable viewer, popup detail viewer, and board lanes
- Added Ctrl+D/Ctrl+U to board lanes and generic list for vim consistency
- Shared `addScrollKeys()` helper in tui.ts for scrollable text widgets
- Generic list gets PGUP/PGDN/Ctrl+D/Ctrl+U/Home/End with proper selectedIndex tracking
- Added scrollbar indicators (inverse block) to standalone viewer, popup detail viewer, detail pane, label picker, and generic list (opt-out via `scrollbar: false`)
- Task list pane skips scrollbar for visual consistency with board swimlanes

**Filter navigation fix:**
- Status/priority selectors: down arrow only exits to task list when at last item (was exiting immediately on any down press)

**TUI screenshot comparison tool (`tools/tui-screenshot-compare.sh`):**
- Bash script for capturing before/after TUI screenshots and generating visual comparisons
- Auto-capture mode: launches TUI in Terminal.app and/or Ghostty, navigates views via System Events keystrokes, captures windows by CGWindowID (Swift + CoreGraphics)
- Captures 4 views per terminal: board, task list, detail pane focused, filters focused
- Manual fallback mode (`--manual`) for click-to-capture when auto-detection fails
- Compare command generates static PNG (vertical stack), animated APNG, and GIF for each view
- Uses ffmpeg for image normalization (width padding), label overlays (drawtext), and animation (concat)
- Multi-terminal support: captures in both Terminal.app and Ghostty by default for cross-terminal visual comparison
- Output organized by terminal: `.tui-screenshots/<label>/<terminal>/<view>.png`
- Configurable via `RENDER_DELAY` and `NAV_DELAY` env vars
- `.tui-screenshots/` added to `.gitignore`

**Files modified:** tui.ts, board.ts, generic-list.ts, filter-header.ts, filter-popup.ts, task-viewer-with-search.ts, loading.ts, overview-tui.ts, status-icon.ts, heading.ts, code-path.ts + corresponding tests, tools/tui-screenshot-compare.sh, .gitignore

**Note (rebase onto upstream/main):** Upstream replaced the inline label picker in task-viewer-with-search.ts with a shared `filter-popup.ts` (single/multi-select popups). The inverse-video treatment from this task was re-applied to that new file so filter-panel highlights remain theme-adaptive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All highlight/selection styling uses inverse video instead of hardcoded ANSI colors
- [ ] #2 Board active: inverse+bold; move mode: inverse+cyan; inactive: cleared
- [ ] #3 Filter header focus uses inverse+bold; blur clears inverse+bold
- [ ] #4 No hardcoded fg: "white" or bg: "black" in TUI text/container styles (backdrop overlays excluded)
- [ ] #5 Semantic colors use "gray" instead of "white" for neutral/muted elements
- [ ] #6 Code paths styled with cyan instead of gray for cross-theme visibility
- [ ] #7 PGUP/PGDN/Home/End work in standalone viewer, popup viewer, board lanes, and generic list
- [ ] #8 Ctrl+D/Ctrl+U work in board lanes and generic list
- [ ] #9 Scrollbar indicators on scrollable content areas (except task list pane)
- [ ] #10 Status/priority filter selectors allow full down-arrow navigation before exiting
- [ ] #11 All tests pass
- [ ] #12 Screenshot tool auto-captures board, tasklist, detail, and filters views in Terminal and Ghostty
- [ ] #13 Screenshot compare command generates static PNG, animated APNG, and GIF comparisons
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Review-fix pass for PR #670:
1. In src/ui/board.ts, apply the same interaction guards used by arrow navigation to the new PageUp/PageDown/Home/End board handlers so they do not mutate board selection while filter controls, filter popups, or modals are active.
2. In src/ui/components/generic-list.ts, route page/home/end navigation through the existing highlighted-index path so grouped lists preserve display-index mapping, highlighted row rendering, and highlight callbacks.
3. In tools/tui-screenshot-compare.sh, move dependency checks into subcommand-specific checks so usage/help is always available, compare only requires compare dependencies, manual capture only requires screencapture, and auto capture checks Ghostty/tmux/Swift/build binary requirements.
4. Add focused tests for the generic-list grouped navigation regression and script dependency behavior where practical, then run targeted tests plus typecheck/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Review fixes applied for PR #670:
- Board PageUp/PageDown/Home/End now respect filter, popup, and modal focus guards and use selectColumnRow to keep the active-row marker in sync.
- GenericList page/home/end navigation now uses setHighlightedIndex so grouped display-index mappings remain correct.
- Screenshot comparison helper dependency checks are now subcommand-specific, so usage/help is not blocked by missing Ghostty.
Verification: bun test src/test/generic-list-selection.test.ts src/test/tui-screenshot-compare-script.test.ts; bunx tsc --noEmit; bun run check .; ./tools/tui-screenshot-compare.sh; bun test.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
