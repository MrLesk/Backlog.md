---
id: BACK-620
title: Align the filter footer hint between TUI kanban and task list
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 18:59'
updated_date: '2026-08-09 19:47'
labels: []
dependencies: []
ordinal: 258000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported by Alex 2026-08-09 with screenshots: the TUI kanban board footer shows "[s/t/p/i/l] Filter" while the TUI task list footer shows "[T/P/F/I] Filter" - different casing, different separator styling, and apparently different letters. Align the two. First determine what filter keybindings each view actually offers (the hints must reflect the real keys); if the filter sets genuinely differ per view, keep the correct letters but unify the presentation (same casing and separator convention); if a hint advertises a key that does not work or omits one that does, fix the hint to match the real bindings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both footers use the same casing and separator convention for the filter hint
- [x] #2 Each footer lists exactly the filter keys that actually work in that view
- [x] #3 A test or recorded verification covers both footer strings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Map the real filter keybindings per view: board (src/ui/board.ts) binds t/T type, p/P priority, f/F labels, i/I milestone (no status filter; l is column nav). Task list (src/ui/task-viewer-with-search.ts) binds s/S status, t/T type, p/P priority, l/L labels, i/I milestone.
2. Confirm no footer hint advertises a dead key: board [T/P/F/I] is accurate; task list [s/t/p/i/l] has the right letters but lowercase and milestone/labels swapped relative to the board and to the task-list help popup order.
3. Unify presentation on the convention already used by the neighbouring footer groups ([E/M/C/A], [E/C/A], [N], [Y], [Tab]) and by the board help popup: uppercase letters, slash separated, no spaces, ordered status/type/priority/labels/milestone. Board keeps [T/P/F/I]; task list becomes [S/T/P/L/I]. No new keys, no extra footer segments.
4. Move both footer strings into src/ui/footer-content.ts as exported constants (module already owns footer formatting and is already imported by both views) so a single test can cover both strings.
5. Align the task-list help popup filter rows to the same uppercase letters so the view does not contradict its own footer.
6. Extend src/test/footer-content.test.ts to assert both footer strings share the filter-hint convention and list exactly the live keys; verify with bunx tsc --noEmit, bun run check ., bun run test, plus a PTY capture of both footers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Keybinding research (verified in a real PTY with tmux capture-pane, 130x30, against src/cli.ts):

Board (src/ui/board.ts): t Type, p Priority, f Labels, i Milestone. No status filter (columns are the statuses). l is column navigation, which is why labels uses f.
Task list (src/ui/task-viewer-with-search.ts): s Status, t Type, p Priority, l Labels, i Milestone.

Root-cause finding: uppercase filter keys do not work in either view. Both views register the pickers as screen.key(["t", "T"]), but neo-neo-bblessed builds key.full as (shift ? "S-" : "") + name (lib/program.ts:480), so Shift+T is delivered as S-t and the "T" listener never fires. PTY probe: board t/p/f/i each opened the expected popup; board T/P/F/I, S and L opened nothing; task list s/t/p/l/i each opened the expected popup; S/T/P/L/I opened nothing. The board footer's [T/P/F/I] and the board help popup's T/P/F/I therefore advertised four keys that do nothing.

Convention chosen: lowercase letters, slash separated, no spaces, ordered the way the shared filter header renders its controls (ALL_FILTER_ITEMS in src/ui/components/filter-header.ts: status, type, priority, milestone, labels). Board becomes [t/p/i/f] (same 9 visible characters as [T/P/F/I], so no footer widening); the task list keeps [s/t/p/i/l] unchanged because it already matched both the real keys and the filter-header order.

Changes: both footer strings moved to src/ui/footer-content.ts as BOARD_FOOTER_CONTENT and TASK_LIST_FOOTER_CONTENT (that module already owns footer wrapping and was already imported by both views), so one test covers both. Board help popup filter rows corrected to lowercase and reordered to match; task-list help popup rows reordered to milestone-before-labels so the popup and its own footer agree. No keybindings changed.

Out of scope observation: the same S- parsing gotcha makes parts of other footer hints wrong. E and M are safe because they also bind S-e/S-m, and H binds S-h, but c, a and y have no S- variants, so [E/M/C/A] and [Y] advertise dead uppercase C, A and Y. Verified in the PTY: lowercase c opened the complete-task confirm dialog, Shift+C did nothing. Not touched here; needs a product decision (fix the hints or add the S- bindings).

Reopened after owner review of PR #892. Owner ruling, verbatim: "uppercase footer instructions don't mean shift + key... They are clearly key indicators. nobody is expecting to press the upper key version."

So uppercase letters in footer and help hints are this TUI's display convention for "this key", not a claim that Shift is required. My lowercasing in #892 misread the design language and broke the footer's own visual grammar, where [Tab], [N], [E/M/C/A] and [Y] are all uppercase indicators. Restoring uppercase display for the filter hints.

The two substantive fixes from #892 stay, because they were about content rather than styling: the corrected letter sets (board has no status filter and uses F for labels since L is column navigation) and the filter-bar ordering (status, type, priority, milestone, labels, matching ALL_FILTER_ITEMS in src/ui/components/filter-header.ts). Shipping [T/P/I/F] on the board and [S/T/P/I/L] in the task list, with the help-popup filter rows uppercased to match the untouched C/A/Y rows. No keybinding changes; the bound keys remain the lowercase letters plus the existing S- variants for e, m, n and h.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned the TUI filter footer hint across the kanban board and the task list.

Both footers now use the same uppercase slash-separated key indicators, in the order the shared filter header renders its controls (status, type, priority, milestone, labels): board [T/P/I/F], task list [S/T/P/I/L]. Uppercase is this TUI's display convention for a key indicator, consistent with [Tab], [N], [E/M/C/A] and [Y]; it does not mean Shift. The bound keys are the lowercase letters (plus the existing S- variants for e, m, n and h) and no binding changed.

Two content fixes beyond styling: the board omits a status filter because its columns are the statuses, and it uses F for labels because L navigates columns there, so the letter sets legitimately differ per view; and the board hint previously listed labels before milestone, which contradicted its own filter bar. The board and task-list help popup filter rows were brought in line with the same letters and order, so each view's footer and its ? popup agree. The hints are the same visible width as before, so the footer does not grow.

Both footer strings live in src/ui/footer-content.ts as BOARD_FOOTER_CONTENT and TASK_LIST_FOOTER_CONTENT, next to the wrapping helper both views already imported.

Verified: src/test/footer-content.test.ts asserts the uppercase indicator convention in both views, that each hint maps to the lowercase keys the view actually binds, and that the help-popup filter rows match each footer; src/test/help-popup.test.ts covers the per-view letter sets. bunx tsc --noEmit clean, bun run check . clean, bun run test 2188 pass / 6 skip / 0 fail. Rendered footers and both help popups confirmed with tmux PTY captures at 130x30, and a PTY key probe confirmed T/P/I/F and S/T/P/I/L still open the expected pickers after the change.

History: PR #892 shipped this with lowercase hints; the owner ruled that uppercase footer letters are key indicators rather than Shift chords, and PR for branch tasks/back-620-uppercase-hints restores uppercase while keeping the corrected letters and order.
<!-- SECTION:FINAL_SUMMARY:END -->
