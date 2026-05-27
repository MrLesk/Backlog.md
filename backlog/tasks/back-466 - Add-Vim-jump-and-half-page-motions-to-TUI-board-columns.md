---
id: BACK-466
title: Add Vim jump and half-page motions to TUI board columns
status: Done
assignee:
  - '@claude'
created_date: '2026-05-27 07:39'
updated_date: '2026-05-27 08:26'
labels:
  - tui
  - enhancement
dependencies: []
references:
  - src/ui/board.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vim users navigating the terminal Kanban board (`backlog board`) can currently only move the selection one row at a time within a status column (`j`/`k`). For long columns this is slow. Add the familiar Vim vertical-navigation motions so users can jump to the top/bottom of a column and move by half-pages, matching the muscle memory of the existing `h/j/k/l` bindings.

Scope is the focused status column's task list in the TUI board only. Half-page semantics match Vim exactly (`Ctrl+d`/`Ctrl+u` = half page; full-page `Ctrl+f`/`Ctrl+b` is intentionally out of scope to avoid disturbing the existing `Ctrl+f` search shortcut). Bindings are identical across macOS/Linux/Windows.

Primary code area: src/ui/board.ts (existing key handlers and the column selection helper).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the TUI board, with a focused column containing multiple tasks, pressing gg selects the first task and Shift+G selects the last task
- [x] #2 Ctrl+d moves the selection down by half the column's visible height and Ctrl+u moves it up by half; both clamp at the column's first/last task and never transfer focus to the search box
- [x] #3 gg triggers only when a second g is pressed within a short timeout window; a single g performs no action
- [x] #4 All four motions are no-ops when the focused column is empty
- [x] #5 In move mode (relocating a task), gg/Shift+G/Ctrl+d/Ctrl+u reposition the move target to top/bottom/half-page within the valid target range (including the append-at-end slot)
- [x] #6 The new keys are listed in the board help popup opened with ?
- [x] #7 Existing j/k boundary-to-search behavior remains unchanged
- [x] #8 Automated tests cover the new navigation and move-mode motions alongside the existing board-navigation tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approach

Keep the index math in a pure, exported, unit-tested helper (mirrors the existing `shouldMoveFromListBoundaryToSearch` / `resolveSearchExitTargetIndex` pattern) and make the board key handlers thin wrappers that call it, then route the result through the existing `selectColumnRow` (navigation) or `moveOp.targetIndex` (move mode) paths so clamping comes for free.

### 1. Pure helper — `src/ui/task-viewer-with-search.ts`
Add alongside the sibling navigation helpers:
```ts
export type VimVerticalMotion = "top" | "bottom" | "halfPageDown" | "halfPageUp";
export function resolveVimMotionIndex(
  motion, currentIndex, totalItems, visibleHeight,
): number
```
- `totalItems <= 0` → 0 (callers already no-op on empty columns).
- `half = max(1, floor(visibleHeight / 2))`.
- top → 0; bottom → totalItems-1; halfPageDown → min(last, current+half); halfPageUp → max(0, current-half).
- Pure and fully clamped; identical for navigation and move mode.

### 2. Key handlers — `src/ui/board.ts`
Add four `screen.key(...)` handlers near the existing `up/k` and `down/j` handlers, each guarded by the same `if (popupOpen || filterPopupOpen || modalOpen || currentFocus === "filters") return;` preamble:
- `gg`: bind `["g"]` with a double-press detector — track `lastGPress` timestamp; only fire `top` when a second `g` lands within ~400ms; a lone `g` is a no-op. No existing `g` binding to conflict with (verified).
- `G`: bind `["S-g"]` → `bottom`.
- `C-d` → `halfPageDown`; `C-u` → `halfPageUp`.

Each handler:
- visibleHeight = `typeof column.list.height === "number" ? column.list.height : column.tasks.length` (sequences.ts:251 pattern; safe fallback).
- Navigation mode: `selectColumnRow(column, resolveVimMotionIndex(motion, list.selected ?? 0, column.tasks.length, visibleHeight), true); screen.render();`
- Move mode (`moveOp`): `moveOp.targetIndex = resolveVimMotionIndex(motion, moveOp.targetIndex, column.tasks.length, visibleHeight); renderView();` (column.tasks already includes the ghost append slot, so range matches current j/k move logic).
- Clamp-in-column only — never set `pendingSearchWrap` / focus search, so existing j/k boundary→search behavior is untouched.

### 3. Help popup — `src/ui/components/help-popup.ts`
Add to `BOARD_SHORTCUTS`:
- `{ key: "gg/G", desc: "Jump to top / bottom of column" }`
- `{ key: "C-d/u", desc: "Half-page down / up" }`
(Popup is 20 rows tall / 15 entries today — fits.)

### 4. Tests — `src/test/`
Unit-test `resolveVimMotionIndex` (the testable surface; existing board tests are pure-function tests, not screen-driven): top, bottom, half-page down/up clamping at both ends, empty list, odd vs even visibleHeight rounding, and visibleHeight=1 → half=1.

## Out of scope
Full-page `Ctrl+f`/`Ctrl+b` (would clash with the `Ctrl+f` search shortcut). Footer hint line left unchanged; discoverability handled via the help popup.

## Validation
`bunx tsc --noEmit`, `bun run check .`, `bun test` (and the board test files).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Vim-style vertical motions to the TUI board's focused column.

**Behavior**
- `gg` jumps to the first task (two `g` presses within a 400ms window; a lone `g` is a no-op).
- `G` (`S-g`) jumps to the last task.
- `Ctrl+d` / `Ctrl+u` move the selection down/up by half the column's visible height.
- All four clamp inside the column and never hand focus to the search box, leaving the existing `j`/`k` boundary→search behavior untouched.
- In move mode they reposition the move target (top/bottom/half-page) within the valid range (including the append-at-end slot).

**Implementation**
- `src/ui/task-viewer-with-search.ts`: new pure, exported `resolveVimMotionIndex(motion, currentIndex, totalItems, visibleHeight)` (+ `VimVerticalMotion` type) that does all clamped index math — mirrors the existing `shouldMoveFromListBoundaryToSearch` / `resolveSearchExitTargetIndex` helpers.
- `src/ui/board.ts`: four thin `screen.key` handlers + a shared `applyVimMotion` closure that reads the list's rendered height (falling back to task count) and routes through `selectColumnRow` (navigation) or `moveOp.targetIndex` (move mode).
- `src/ui/components/help-popup.ts`: added `gg/G` and `C-d/u` rows to the board shortcuts.
- `src/test/board-vim-motion.test.ts`: unit tests for the helper (top/bottom, half-page clamping both ends, empty list, odd-height rounding, tiny-height minimum step).

**Testing note**
Tests target the pure index helper (the testable surface), consistent with the existing board tests which are pure-function rather than screen-driven. The `gg` double-press timing and move-mode wiring are exercised through the shared helper but not via a simulated blessed screen.

**Validation**: `bunx tsc --noEmit`, `bun run check .` (changed files), and full `bun test` (1250 pass / 0 fail) all pass.

**Out of scope**: full-page `Ctrl+f`/`Ctrl+b` (would clash with the existing `Ctrl+f` search shortcut).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
