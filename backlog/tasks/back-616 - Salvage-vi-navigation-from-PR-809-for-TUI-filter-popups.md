---
id: BACK-616
title: 'Salvage vi navigation from PR #809 for TUI filter popups'
status: To Do
assignee: []
created_date: '2026-08-09 13:49'
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
- [ ] #1 Filter popups support j/k navigation consistently with the rest of the TUI
- [ ] #2 Original author credit is preserved where feasible
- [ ] #3 A test or recorded interactive verification covers the popup navigation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
