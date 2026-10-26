---
id: BACK-794
title: >-
  Fix web UI select arrows, All Tasks due-date alignment and label chip
  truncation
status: Done
assignee:
  - '@claude'
created_date: '2026-10-26 09:55'
updated_date: '2026-10-26 12:13'
labels:
  - bug
dependencies: []
references:
  - src/web/styles/source.css
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/web/components/Settings.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/MilestonesPage.tsx
  - 'https://github.com/MrLesk/Backlog.md/issues/1156'
modified_files:
  - src/web/styles/source.css
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/web/components/Settings.tsx
  - src/web/components/MilestonesPage.tsx
type: bug
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In Chromium-based browsers (reported in Brave 1.98 on macOS, Backlog.md 1.54.0), three small styling problems make the browser UI look broken:

- Every `<select>` (Kanban board filters, All Tasks filters, Settings, task details, milestone removal) uses the native arrow, which Chromium draws flush against the right border while the text keeps its padding. The look differs per browser.
- In All Tasks, the "Due:" line of a task sits under the acceptance-criteria ring instead of under the title.
- In the All Tasks Labels column, long labels are clipped mid-character with no ellipsis, because the chips are `inline-flex` and a flex container does not apply `text-overflow`.

The reporter does not want screenshots in the public issue because they contain work data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every select in the web UI shows the same chevron with inner padding matching the text, in light and dark mode, in Chromium and WebKit browsers
- [x] #2 In All Tasks, the due date of a task lines up with the start of its title, with and without an acceptance-criteria ring slot
- [x] #3 In All Tasks, a label chip that is too long ends in an ellipsis and keeps its full name in the tooltip
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Give every select one shared look in src/web/styles/source.css (base layer): appearance none, an SVG chevron as background image placed 0.75rem from the right, a lighter chevron in dark mode.
2. Reserve room for the chevron by replacing px-3 with pl-3 pr-9 on the select class lists in TaskList, Board, Settings and MilestonesPage (TaskDetailsModal already has pr-10), since Tailwind utilities override base-layer padding.
3. In the All Tasks title cell, indent the due line by the ring slot width plus the gap-2 between slot and title, keeping the ring slot as the title sibling that the existing alignment tests rely on.
4. Make the All Tasks label chips block-level (inline-block, min-w-0) so truncate shows an ellipsis.
5. Check with bun run check, type check, the web tests, and screenshots in a Chromium browser in light and dark mode.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Wrapping the title row and due line in one column broke three tests in src/test/web-task-acceptance-progress.test.tsx that expect the ring slot right before the title, so the due line gets a padding-left of the slot width plus 0.5rem instead.
Verified on a demo project in Brave 1.98.60 (headless, Playwright) and WebKit 18.2 (Playwright build), light and dark mode: selects compute appearance none, 36px right padding and the SVG chevron; the due date and title both start at x=501; label chips compute display block and text-overflow ellipsis. Screenshots of All Tasks, Kanban board and Settings show the padded chevron, aligned due dates and ellipsized chips.
Running the browser server from another directory needs bun --config=<repo>/bunfig.toml, otherwise bun-plugin-tailwind does not run and the page is unstyled.
Full suite: 22 failures, none in web code. scripts/update-nix.test.cjs (3) fails identically on clean upstream/main on this machine. The decision archive, record creation and content-store tests pass on this branch when run on their own (136/136); they fail only under full-suite load.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every web select now uses appearance none with one shared SVG chevron from source.css (lighter in dark mode), and the select class lists reserve room for it with pr-9, so the arrow no longer sits against the border in Chromium browsers and looks the same in WebKit. In All Tasks, the due date line is indented by the ring slot width plus the gap so it starts under the title, and label chips are block-level so truncate shows an ellipsis. Verified in Brave 1.98.60 and WebKit 18.2 in light and dark mode with DOM measurements and screenshots; type check, Biome and all web tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
