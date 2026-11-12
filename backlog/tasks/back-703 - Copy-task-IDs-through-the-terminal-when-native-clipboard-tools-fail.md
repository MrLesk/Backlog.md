---
id: BACK-703
title: Copy task IDs through the terminal when native clipboard tools fail
status: Done
assignee:
  - '@codex-terminal-clipboard'
created_date: '2026-09-27 22:57'
updated_date: '2026-09-27 23:13'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/947'
  - 'https://github.com/MrLesk/Backlog.md/pull/961'
type: enhancement
ordinal: 333000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repair contributor PR #961 so the existing TUI copy-task-ID action can request clipboard copying through a supporting terminal when native clipboard tools fail, including the stated tmux route. Keep the behavior in the shared clipboard primitive and retain the contributor history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Successful native clipboard copying retains its current priority and emits no terminal fallback sequence.
- [x] #2 After native tool failure, the existing copy primitive sends the task ID through the controlling terminal using the established OSC 52 protocol and handles the supported tmux route.
- [x] #3 A missing controlling terminal or failed fallback returns failure without corrupting ordinary output or changing files.
- [x] #4 Meaningful tests exercise native success, fallback, and failure behavior; the existing contributor PR and authorship are retained.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve contributor commit 4fcef8fd66eadb76f05cc2638e749fc6a175badd and deliver the repair through the original PR #961.
2. Keep copyToClipboard as the shared entry point. Preserve native commands, their priority, input, exit handling, stderr, and DEBUG diagnostics. Return immediately on native success.
3. After native failure, open the controlling terminal without create/truncate flags, verify it is a terminal, and close it in every path. Keep tmux load-buffer -w followed by DCS passthrough on command failure; otherwise send OSC 52 directly. Keep sequence construction private and ordinary stdout unchanged.
4. Test native success, command order, diagnostics, captured terminal output, missing terminal, non-terminal files, open/write failures, and handle cleanup. Verify both tmux routes with a unique socket, minimal test-only configuration, captured outer terminal, mandatory native stubs, and a disabled-passthrough control.
5. Run focused tests, TypeScript, and Biome checks. Review for simpler code and document request-submission limits without adding UI, settings, or platform guarantees.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The shared clipboard helper now tries the existing native commands first. Successful native copying does not open a terminal or invoke tmux. After native failure, the fallback opens /dev/tty with O_WRONLY, checks isatty, and always closes the handle. It uses tmux load-buffer -w first inside tmux, then DCS passthrough if the command fails. Other terminals receive OSC 52 directly. Existing native stderr and DEBUG behavior are preserved. No extra exported API, UI change, or configuration was added.

Validation with Bun 1.3.14: 12 focused tests passed with 84 assertions; TypeScript passed; Biome passed across 439 files. Tests verify native success and priority, command input, diagnostics, UTF-8 requests, ordinary stdout, missing terminals, non-terminal files, open/write failures, and cleanup. Isolated tmux 3.6a tests captured both forwarding routes. A disabled-passthrough control produced no request despite successful submission. Architecture review found no worthwhile simplification.

Contributor commit 4fcef8fd66eadb76f05cc2638e749fc6a175badd remains an ancestor of the reviewed repair candidate for original PR #961. The candidate contains only the three clipboard source/test paths and this task record.

Test isolation correction: the first three tmux test attempts changed PATH after Bun started. A harmless probe showed that Bun 1.3.14 still resolved commands from startup PATH, so those attempts could have invoked /usr/bin/pbcopy with BACK-703. Clipboard contents were not read or restored. The corrected tests set stub-only PATH before startup, check exact stub resolution, use absolute stub paths, require native invocation logs, and retain failure traces.

Limits: successful submission or forwarding does not confirm physical clipboard receipt. Windows and Linux command selection was simulated on macOS; no native host run was performed for those platforms. The tmux integration tests require version 3.3 or later for the allow-passthrough control. Protocol references: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html and https://man.openbsd.org/tmux.1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a terminal clipboard fallback to the shared copy helper while preserving native-copy priority and diagnostics. The fallback validates the controlling terminal and supports the existing tmux routes without changing ordinary stdout or creating files.

Verified with 12 passing tests, TypeScript, Biome, and captured output from an isolated tmux server. Contributor history is retained for original PR #961. Terminal requests remain best effort; physical clipboard receipt is not confirmed.
<!-- SECTION:FINAL_SUMMARY:END -->
