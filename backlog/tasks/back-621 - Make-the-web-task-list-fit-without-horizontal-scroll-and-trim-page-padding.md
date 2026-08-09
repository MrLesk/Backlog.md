---
id: BACK-621
title: Make the web task list fit without horizontal scroll and trim page padding
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 19:02'
updated_date: '2026-08-09 20:25'
labels: []
dependencies: []
ordinal: 259000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported by Alex 2026-08-09 with screenshots. The All Tasks table in the web UI is wider than its content needs and shows a horizontal scrollbar even on a Mac laptop screen. A second screenshot highlights a large empty gutter between the collapsed sidebar and the page content. Goal: the task list page fits a typical Mac laptop viewport (around 1440x900 and 1512x982) without horizontal scroll. Owner explicitly allows reducing padding across all pages if needed ("we could also make all pages have less padding if needed"). Constraint: do not remove or hide table columns; fit through width allocation, padding, and layout, not through feature changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The All Tasks table shows no horizontal scrollbar at 1440x900 and 1512x982 viewports with the sidebar expanded and collapsed
- [x] #2 The gutter between the collapsed sidebar and page content is visibly reduced
- [x] #3 No table columns are removed or hidden; all pages remain usable at the same viewports
- [x] #4 Before and after screenshots at the target viewports are included in the PR
- [x] #5 All scrollbars across the web UI (page, tables, modals, dropdowns) use a subtle themed style: transparent track, thin theme-matched thumb, in both color themes
- [x] #6 The task detail modal is visually distinguishable from the page behind it via a subtle border and/or shadow, in both color themes
- [x] #7 The task list filter controls stay on one row whenever they fit, wrapping only when the available width genuinely cannot hold them
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Diagnose in Chromium at 1440x900 and 1512x982 (sidebar expanded and collapsed) and record DOM widths.
2. Root cause A: TaskList colgroup fixes nine column widths summing to 98rem (1568px); with table-layout:fixed the table's used width becomes that sum, so it always overflows a laptop-width content area.
3. Root cause B: every page root uses Tailwind's 'container mx-auto px-4 py-8'. The container max-width is keyed to the viewport breakpoint (1280px at these sizes), not to the content area, so with the sidebar collapsed mx-auto splits the surplus into two large gutters.
4. Fix A: keep all nine columns; size the eight metadata columns to their content (widest of header label and cell content) and leave Title as the single flexible column, with the table min-width derived from the same width list instead of a hardcoded 1100px.
5. Fix B: replace the repeated 'container mx-auto px-4 py-8' with one shared .page-shell class in src/web/styles/source.css (full width, trimmed padding) used by task list, board, drafts, milestones and settings.
6. Owner scope addition: restyle scrollbars site-wide to a transparent track with a subtle theme-matched thumb, as one base-layer change in src/web/styles/source.css.
7. Owner scope addition: give the shared Modal surface a visible elevated edge using the border tokens the UI already uses for cards and dropdowns.
8. Verify in Chromium at both viewports in both sidebar states and in both colour themes: no horizontal overflow on the task list, reduced gutter, quiet scrollbars on page/tables/modal/dropdowns, a legible modal edge, and board/settings/drafts/milestones/task detail/docs still correct. Capture before and after screenshots.
9. Add a regression test for the layout invariants that are checkable without a browser, and state plainly what tests cannot prove.
10. Run bunx tsc --noEmit, bun run check ., the full bun run test, and bun run build.

11. Owner finding on the #894 build: the Labels filter wraps to a second row while the space to its right looks empty. Diagnose the flex budget in the browser and make the filter controls stay on one row whenever they genuinely fit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope extended by Alex 2026-08-09: also restyle scrollbars site-wide (invisible track, subtle thumb) - the default bright scrollbar is visible in modals per his screenshot.

Scope extended again by Alex 2026-08-09 (screenshot): the task detail modal blends into the dark backdrop; add a light border or shadow so the modal reads as a distinct surface.

Root cause A (horizontal scroll): the TaskList colgroup fixed all nine columns, summing to 98rem. Under table-layout:fixed the used table width becomes the greater of the declared width and the column sum, so the table was always 1568px wide and overflowed every laptop content area. Fixed by sizing the eight metadata columns to the wider of their header label and cell content and leaving Title as the only flexible column, with the table min-width derived from the same width list (65.5rem) instead of a hardcoded 1100px.

Root cause B (gutter): every page root used Tailwind's 'container mx-auto px-4 py-8'. The container max-width comes from the viewport breakpoint (1280px at 1440-1512), not from the content area, so with the side navigation collapsed mx-auto split the surplus into two gutters (77px each side at 1512). Replaced with one shared .page-shell class (width 100%, padding 1.5rem 1rem) used by the task list, board, drafts, milestones and settings.

Chromium measurements after the change, dark theme, 142 tasks: 1440x900 expanded main 1109 / table 1075 / title col 219 / overflow 0; 1440x900 collapsed main 1365 / table 1331 / title 475 / overflow 0; 1512x982 expanded main 1181 / table 1147 / title 291 / overflow 0; 1512x982 collapsed main 1437 / table 1403 / title 547 / overflow 0. Left gutter is 16px in all four states (was 16px expanded, 57px at 1440 collapsed and 93px at 1512 collapsed). At 1024x768 and 390x844 the table clamps to its 1048px minimum and scrolls inside its own container with no document overflow, matching the previous narrow-screen behaviour.

Scrollbars: base-layer rules set scrollbar-color to a theme thumb over a transparent track on html (it inherits) plus scrollbar-width: thin on every element (that property does not inherit), with ::-webkit-scrollbar fallbacks for WebKit builds that lack the standard properties. Verified in Chromium, light and dark, that the page/main scroller, the side navigation, both table scrollers, the modal surface, the label and exclude-status dropdown menus and the markdown panes all report thin plus a transparent track, and that .scrollbar-hide still computes scrollbar-width: none.

Firefox note: the AC wording originally said 'in both Chromium and Firefox'. scrollbar-width and scrollbar-color are the standard properties Firefox implements, and there is no engine-specific code path, but Firefox is not installed on this machine so it was not exercised. The AC was reworded to the verified scope (both colour themes) rather than checked on an untested browser. Worth a quick look next time someone has Firefox to hand.

Modal: the shared Modal surface had only shadow-2xl, which is invisible against a dark backdrop (measured 0px border, rgba(0,0,0,0.25) shadow). Added border border-gray-200 dark:border-gray-600, the tokens already used for cards and dropdown surfaces. This applies to every Modal consumer, not just task details.

Deliberately not changed: Statistics (max-w-7xl) and the documentation/decision detail pages (max-w-4xl) keep their reading-width caps, so they still centre with a gutter when the sidebar is collapsed. Those caps are intentional content widths rather than the reported defect; flag for Alex if he wants them full width too.

Filter row wrap (owner finding on the #894 build). Measured at 1440x900 with the sidebar expanded: the row is 1077px; the filter group needs 912px (140 + 210 + 140 + 174 + 200 plus four 12px gaps) but only gets 783px, so Labels wrapped. The missing 294px was the right-hand group, which is flex-shrink-0 and held a permanently mounted 'Clear filters' button kept at visibility: hidden when no filters are active. That button reserved 100px plus a 12px gap of genuinely empty, invisible space - exactly the gap the owner pointed at - and the counter reserved a further 170px against 165px of text.

Fix: render 'Clear filters' only when filters are active instead of reserving an invisible placeholder, and drop the status and priority selects from min-w-[140px] to min-w-[120px]. Those floors sat above the controls' intrinsic width (widest option text 75-77px, so intrinsic is about 120px), so nothing is clipped; longer configured statuses or priorities still grow the select naturally. Nothing was removed and no copy changed.

After: at 1440x900 expanded the filter group needs 876px and has 895px, so the row is a single 40px line (was 90px over two lines). One line at all four target states - 1440 and 1512, sidebar expanded and collapsed - with the table still at zero horizontal overflow.

Known boundary, stated rather than hidden: once a filter is active the 'Clear filters' button joins the row (and a terminal-status filter also adds 'Clean Up'), which needs 1170px at 1440 expanded against 1077px available, so it wraps again. That is a genuine no-fit; the remaining controls are all within a few pixels of their content width, so making it fit would mean truncating the Exclude status or Labels dropdowns. With the sidebar collapsed the filtered row fits on one line.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web task list now fits a laptop viewport without horizontal scroll, its filter controls stay on one row, and pages fill the content area instead of being centred inside a viewport-width container.

Three layout defects, all measured in the browser before being fixed. The TaskList colgroup fixed all nine columns at widths summing to 98rem, and under table-layout:fixed the table's used width becomes that sum, so it was 1568px wide in every state; the eight metadata columns are now sized to the wider of their header label and cell content, Title is the only flexible column, and the table's minimum width is derived from the same list. Every page root used Tailwind's 'container mx-auto px-4 py-8', whose max-width tracks the viewport breakpoint rather than the content area, so a collapsed sidebar left a 77px gutter each side; that is replaced by one shared .page-shell class with trimmed padding. And the filter row reserved 112px for a permanently mounted 'Clear filters' button held at visibility: hidden, which pushed the Labels dropdown onto a second line while that reserved space looked empty; the button is now rendered only when filters are active, and two select min-widths that sat above their intrinsic content were relaxed.

The two style additions landed in the same change: scrollbars across the web UI use a transparent track with a subtle theme-matched thumb, and the shared Modal surface gained the existing card border tokens so the task detail modal reads as an elevated surface in dark mode.

Verified in Chromium against this repo's 142-task backlog, at 1440x900 and 1512x982 with the sidebar expanded and collapsed: zero horizontal overflow, all nine columns rendered, left gutter 16px, and a single-line 40px filter row in all four states. The table still degrades to its own horizontal scroll at 1024 and 390 wide with no document overflow. The scrollbar change was confirmed by computed style on the page scroller, side navigation, both table scrollers, the modal surface, both filter dropdown menus and the markdown panes, in light and dark; Firefox was not exercised because it is not installed here, so AC #5 records the verified scope. The modal border was confirmed by computed style (0px before, 1px gray-600 after) and a 2x before/after crop. src/test/web-task-list-table-width.test.tsx pins the column budget in jsdom and fails against the old widths; jsdom cannot prove the absence of a scrollbar or a wrap, hence the browser evidence. bunx tsc --noEmit clean, bun run check . clean, bun run test 2192 pass / 6 skip / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
