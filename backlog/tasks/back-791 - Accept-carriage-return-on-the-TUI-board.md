---
id: BACK-791
title: Handle normalized Enter keys on the TUI board
status: Done
assignee:
  - '@codex'
created_date: '2026-10-25T19:37:00Z'
updated_date: '2026-10-25T19:42:00Z'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1003'
  - src/ui/board.ts
  - src/test/board-tui-move.test.ts
  - src/test/board-popup-sync.test.ts
modified_files:
  - src/test/board-tui-move.test.ts
  - src/test/board-popup-sync.test.ts
  - src/ui/board.ts
priority: medium
type: bug
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1003 reports board actions that fail for terminal Enter input. Full pipeline inspection shows the maintained library aliases CR to enter and separately exposes LF as linefeed. The board should use those canonical event names, preserve the working CR path, and accept LF without subscribing to both aliases of a single physical key.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both raw carriage return and raw line feed open the selected task on the board.
- [x] #2 Canonical enter and linefeed events confirm a move exactly once and preserve existing modal guards.
- [x] #3 Rendered-board regressions and real pseudo-terminal checks cover both physical input bytes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace both keys.ts and Program input normalization and verify raw CR/LF in a pseudo-terminal.
2. Bind the canonical enter and linefeed events in the existing board handler, avoiding duplicate CR aliases. Cover popup opening, moves and guards with rendered-board tests.
3. Run real input smoke checks, focused tests, types/lint/build, then simplify and obtain Codex review before merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Full pipeline inspection confirmed that neo-neo-bblessed Program already aliases raw CR to enter and exposes raw LF as linefeed. A raw CR smoke also passed using unchanged main. The missing linefeed binding was reproduced by both rendered-board tests and raw input before the fix.

The board now binds enter and linefeed in one existing handler. It deliberately avoids the return alias, which would subscribe to a second event for the same CR. No dependency release, decoder shim or exported key helper is needed.

Verification: 39 popup/move/help tests passed, including an explicit one-write assertion for repeated input under both canonical names. Separate real pseudo-terminal runs sent raw CR and raw LF; each opened the selected popup, persisted a status move, and exited 0. Types, Biome, build and diff checks passed. The final maintenance pass kept the implementation to one binding and a comment explaining normalization.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The board now handles the maintained terminal library’s canonical enter and linefeed events without subscribing to duplicate CR aliases. Both raw physical inputs open tasks and confirm moves. All 39 focused tests, types, lint and build passed; pseudo-terminal checks verified raw CR and LF and baseline CR behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
