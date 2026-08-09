---
id: BACK-617
title: Fix web board drag-and-drop when hideEmptyColumns is enabled
status: To Do
assignee: []
created_date: '2026-08-09 16:05'
labels: []
dependencies: []
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by Alex 2026-08-09. Shipped defect in the BACK-522 web board code, reported with analysis by janosmiko during PR #808: Board.tsx flips isDragging synchronously inside dragstart, which re-inserts hidden columns mid-drag; per his report Chromium cancels the native drag as a result, so cards become undraggable whenever hideEmptyColumns is on. First verify the defect against the current web board, then fix. His unmerged hardening from PR #808 (deferred column expansion, scroll preservation, edge auto-scroll) is the starting point; take what applies with credit (cherry-pick or Co-authored-by) and keep the scope to making drag work correctly with hidden columns, not a general DnD overhaul.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With hideEmptyColumns enabled, cards can be dragged and dropped on the web board in Chromium
- [ ] #2 Hidden empty columns become available as drop targets during a drag, consistent with the TUI move-mode behavior
- [ ] #3 Contributor credit is preserved where his changes are used
- [ ] #4 Tests cover dragging with hidden columns on and off
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
