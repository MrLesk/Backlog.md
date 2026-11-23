---
id: BACK-836
title: Restore mouse wheel scrolling in the terminal board
status: Done
assignee:
  - '@codex'
created_date: '2026-11-23T20:58:00Z'
updated_date: '2026-11-23T21:12:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1211
  - https://github.com/MrLesk/neo-neo-blessed/blob/v1.0.10/lib/program.ts
  - package.json
  - https://github.com/MrLesk/neo-neo-blessed/pull/3
modified_files:
  - package.json
  - bun.lock
  - bun.nix
type: bug
ordinal: 435000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the terminal board, mouse setup sends conflicting commands. Ghostty stops sending wheel events for the column under the pointer. Correct the shared terminal library and carry its fix into the shipped CLI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A wheel gesture over a task column moves its selection in both directions when the terminal provides mouse input, including when another column has focus.
- [x] #2 Mouse setup and teardown preserve the library’s supported terminal protocols and explicit mode settings. Keyboard navigation still works when mouse reports are unavailable.
- [x] #3 The CLI build includes the fix and a regression check detects the original failure.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add regression tests for mouse mode selection, partial updates, and teardown in the bblessed publishing branch, and fix how unspecified modes are handled. 2. Build the candidate and exercise the board with Ghostty, xterm-compatible terminals, tmux, and keyboard navigation. 3. After verification, merge and publish bblessed 1.0.11 with the approved release workflow. Pin that release in Backlog.md, regenerate its Bun and Nix locks, validate the CLI build, and open the Backlog.md PR for review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The library regression failed on 1.0.10 and passed with the fix. The compiled board was exercised with the Ghostty and xterm.js engines, directly and through tmux 3.8. In all four cases the wheel selected tasks in the column under the pointer in both directions, scrolled to a previously hidden task, and stopped reporting after exit. With mouse reports disabled, keyboard navigation still worked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published the mouse mode fix in neo-neo-bblessed 1.0.11. The library now changes only the requested mouse settings, so startup and focus updates preserve the protocol selected for each terminal. Backlog.md pins the published package in Bun and Nix. A clean macOS arm64 build passed the Ghostty and xterm.js wheel checks directly and through tmux, including cross-column selection, keyboard navigation, and cleanup on exit. The library suite passed all 417 tests. Backlog.md passed type checking, Biome, 88 scoped tests, 11 compiled terminal tests, and the binary smoke test. Rex and physical trackpad input were not tested.
<!-- SECTION:FINAL_SUMMARY:END -->
