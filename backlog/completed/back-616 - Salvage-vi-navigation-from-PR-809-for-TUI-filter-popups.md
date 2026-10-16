---
id: BACK-616
title: 'Salvage vi navigation from PR #809 for TUI filter popups'
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-09 14:27'
labels: []
dependencies: []
ordinal: 255000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Salvage approved by Alex (2026-08-09: "ok. take over same as above"). janosmiko opened https://github.com/MrLesk/Backlog.md/pull/809 with two fixes; the status picker fix already landed via BACK-565/#833 with credit. The remaining piece: filter popups do not enable vi-style j/k navigation (blessed list option vi: true). Take the remaining change from the contributor branch, preserving credit via cherry-pick where feasible, bring it to standards on top of current main (the filter popup was reworked in BACK-565: see createScrollableViewport/fitToScreen in src/ui/components/filter-popup.ts), and prepare for merge. After merge the PR gets closed as superseded with a credit note (coordinator handles the closing).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Filter popups support j/k navigation consistently with the rest of the TUI
- [x] #2 Original author credit is preserved where feasible
- [x] #3 A test or recorded interactive verification covers the popup navigation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Study PR #809 (janosmiko): its only filter-popup change is `vi: true` on the single-select picker plus a help-text tweak; the `picker.select(selectedIndex)` half already landed via BACK-565.
2. Preserve credit: commit the extracted filter-popup hunk from PR #809 verbatim with the original author, then adapt it in a follow-up commit.
3. Adapt for TUI consistency: `vi: true` also binds l=select, g/G, H/M/L and Ctrl+B/F, which no other list in the TUI does. generic-list.ts (used by the multi-select filter popup) hand-wires j/k alone, so hand-wire j -> picker.down(1) / k -> picker.up(1) on the single-select picker instead and drop `vi: true`.
4. Make the multi-select popup's help row honest: it already navigates with j/k through generic-list but advertises only the arrows.
5. Prove it: add popup navigation tests to src/test/tui-vim-boundary-navigation.test.ts driving real key events through both filter popups (harness emits keypress + 'key <name>' like the existing TUI tests).
6. Verify: bunx tsc --noEmit, bun run check ., full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Salvaged from PR #809 (janosmiko). The only filter-popup change left in that PR was `vi: true` on the single-select picker plus a help-text tweak; its other half (picker.select(selectedIndex)) had already landed via BACK-565.

Authorship: the extracted filter-popup hunk is committed verbatim as the first commit on this branch with János Mikó as author (git --author, his commit email), and the adaptation follows as a separate commit.

Adaptation and why: neo-neo-bblessed's list binds j/k only under `vi`, but that same flag also binds l=select, q=cancel, g/G, H/M/L and Ctrl+B/U/D/F on the picker. No other list in the TUI does that - generic-list.ts (which backs the multi-select filter popup) hand-wires the vim keys to plain up/down. So `vi: true` was replaced with two explicit bindings on the picker: j and k select the neighbouring index. The list widget's select() clamps, which is exactly what ArrowUp/ArrowDown already do in that popup, so arrow behaviour is untouched and j/k behave identically to them. Implemented through select() rather than up()/down() because src/types/neo-neo-bblessed.d.ts (the project's ambient subset of the library types) already declares select and not up/down, so no type surface had to grow.

Also updated the multi-select popup's help row to advertise j/k: that popup is a GenericList and has navigated with j/k since BACK-584, so its arrow-only hint was stale.

Scope note: nothing else from PR #809 was taken (its composer fixes are unrelated), and no existing behaviour changed. The two popups keep their pre-existing and different boundary behaviour - the single-select picker clamps at both ends, the GenericList-backed multi-select wraps - because that is what their arrow keys already did, and BACK-584 deliberately left filter popups on circular wrap.

No conflict with any product decision found in the task history: BACK-584's boundary rules apply to the task list, detail pane and board (which have a search handoff), not to popups, and no config key was added.

Verification evidence:
- src/test/tui-vim-boundary-navigation.test.ts gained a 'vim keys navigate the filter popups' block driving real key events through both popups on a real screen: j/k step the single-select picker and clamp at both ends (Enter then returns the j/k-selected value, not the preselected one), and j/k step the wrapping multi-select picker so Space+Enter applies the j/k-selected label.
- Mutation control: with src/ui/components/filter-popup.ts reverted to origin/main, the single-select test fails (5 pass / 1 fail); with the change it passes.
- Real PTY check with expect (board TUI in a temp project, 140x40): opening the Priority Filter popup with 'p', pressing j, then Enter leaves the header button on 'high'; the same script with no navigation key leaves it on 'All'; and the same script with j against origin/main's filter-popup.ts also leaves it on 'All', so the real terminal path (screen -> focused picker -> 'key j') is what changed.
- Board's own screen-level j/k (added by BACK-584) are already guarded by filterPopupOpen, so they do not fire behind an open popup; neither filter popup contains a text input, so j/k cannot capture typing.
- bunx tsc --noEmit clean, bun run check . clean, bun run test 2144 pass / 6 skip / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI's single-select filter popups (status, priority, milestone, and the task composer's Status/Type/Priority pickers) now navigate with j/k as well as the arrow keys, closing the last open piece of PR #809 by janosmiko. His extracted filter-popup hunk is the first commit on the branch under his own authorship; the follow-up commit replaces the library's `vi` flag with two explicit j/k bindings, because `vi` would also have bound l=select, g/G, H/M/L and Ctrl+B/U/D/F on the picker while every other list in the TUI (generic-list.ts, which backs the multi-select popup) wires the vim keys to plain up/down. j/k now do exactly what the arrows already did, including clamping at both ends, so no other popup behaviour changed. The multi-select popup's help row also stopped claiming arrows-only, since it has navigated with j/k since BACK-584. Verified with new key-event tests over both popups, a mutation control against origin/main, and a real-PTY expect check of the board's Priority Filter popup (j+Enter lands on 'high'; the same script on origin/main lands on 'All'), plus tsc, biome and the full suite at 2144 pass / 6 skip / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
