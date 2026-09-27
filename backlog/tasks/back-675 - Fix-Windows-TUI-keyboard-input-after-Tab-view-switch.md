---
id: BACK-675
title: Fix Windows TUI keyboard input after Tab view switch
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 17:42'
updated_date: '2026-09-01 18:09'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/936'
type: bug
ordinal: 307000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On Windows standalone builds, switching between the board and task list with Tab renders the destination view but stops all keyboard input, including Ctrl+C. Restore reliable input across both view-switch directions without changing documented TUI behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On Windows, switching from board to task list preserves keyboard input
- [x] #2 On Windows, switching from task list to board preserves keyboard input
- [x] #3 Existing quit, navigation, search, and Tab bindings continue to work after a switch
- [x] #4 Automated tests cover the view handoff regression
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Hold a lightweight blessed program lease for the lifetime of runUnifiedView so destroying an individual screen never drops stdin ownership to zero during Tab handoff.
2. Release the lease on both ordinary cleanup and process exit so raw mode and stdin are restored exactly once.
3. Add focused lifecycle tests that prove a screen replacement does not pause stdin mid-session and final cleanup still restores it.
4. Run the scoped TUI tests, type-check, Biome checks, and repeat the Windows PTY board-to-list interaction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced before the fix on Windows with a live PTY: board -> Tab rendered the task list, then q and Ctrl+C produced no input; the Bun process required external termination.

Kept one lightweight blessed program alive for the whole unified-view session. Individual screen destruction therefore never drops blessed's shared stdin owner count to zero between views, while the idempotent session release still restores raw mode and pauses stdin on final cleanup/process exit.

Verification:
- bunx tsc --noEmit passed.
- Biome passed for all four changed TypeScript files.
- bun test --timeout=10000 src/test/tui-input-lifecycle.test.ts src/test/tab-switching.test.ts passed (4 tests, 41 assertions).
- bun run build passed.
- The freshly compiled dist/backlog.exe completed board -> list -> board, accepted j/right navigation, opened and exited / search, and quit with q (exit 0).

Repository-wide caveats unrelated to this change:
- bun run check . reports 326 existing CRLF formatting diagnostics across untouched files on this Windows checkout; changed-file checks pass.
- The full test suite was stopped after unrelated Windows baseline failures cascaded through missing Unix tools, existing file locks/timeouts, and dependency patch expectations; the scoped regression suite remains green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented Windows stdin from being paused between unified TUI screens by retaining a blessed program lease for the session and releasing it exactly once on cleanup. Added lifecycle regression coverage and verified the compiled Windows binary across repeated Tab switches, navigation, search, and quit.
<!-- SECTION:FINAL_SUMMARY:END -->
