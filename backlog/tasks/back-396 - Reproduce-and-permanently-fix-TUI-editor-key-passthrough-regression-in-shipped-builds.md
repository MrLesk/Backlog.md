---
id: BACK-396
title: >-
  Reproduce and permanently fix TUI editor key passthrough regression in shipped
  builds
status: Done
assignee:
  - '@codex'
created_date: '2026-02-22 12:41'
updated_date: '2026-02-22 13:24'
labels:
  - bug
  - tui
  - release
  - build
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/457'
  - 'https://github.com/MrLesk/Backlog.md/pull/468'
  - 'https://github.com/MrLesk/Backlog.md/pull/533'
documentation:
  - 'https://github.com/oven-sh/bun/pull/23341'
  - 'https://github.com/oven-sh/bun/issues/23536'
  - 'https://github.com/oven-sh/bun/releases/tag/bun-v1.3.9'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate issue #457 as a shipped-binary/runtime problem, not just a source-test problem. Reproduce on a build that matches release conditions, identify root cause with upstream Bun/runtime evidence, implement a permanent fix, and verify with compiled build artifacts and interactive terminal behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regression is reproduced against a release-equivalent compiled path (not only source tests), with evidence captured.
- [x] #2 Root cause is documented with primary-source evidence and maps directly to the implemented fix.
- [x] #3 CI and release Bun version pinning is updated to a safe version that includes stdin pause/subprocess fix and no longer requires the old pin rationale.
- [x] #4 Interactive regression coverage validates key passthrough behavior relevant to terminal editors (not only editor launch/mutation).
- [x] #5 `bun run build` artifact is validated through an interactive edit flow proving terminal-editor keys/functionality work as expected.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce issue #457 against release-equivalent compiled binaries by running interactive TUI edit flows under Bun 1.2.23 and Bun 1.3.9, capturing transcripts and behavioral differences.
2. Confirm root cause with upstream Bun evidence (stdin pause/subprocess handoff fix and websocket regression closure) and map evidence directly to project release pipeline pins.
3. Improve interactive regression coverage to assert key passthrough behavior relevant to terminal editors, not only editor launch/file mutation.
4. Update CI and release workflow Bun version pinning and related cache keys/comments to a safe 1.3.x version.
5. Verify with focused tests, then validate `bun run build` artifact via an interactive compiled-binary editor flow.
6. Perform simplification pass to remove any unnecessary workaround complexity introduced by prior attempts while preserving behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause tied to shipping/runtime layer, not only terminal mode handling: release and CI pipelines were still pinning Bun `1.2.23`, while upstream Bun includes stdin pause/subprocess handoff fixes in 1.3.x (PR #23341). The prior websocket regression that motivated the downgrade was closed (#23536), so pin rationale is obsolete.

Code changes:
- `.github/workflows/release.yml`: upgrade setup-bun pin and cache key from 1.2.23 to 1.3.9.
- `.github/workflows/ci.yml`: same 1.3.9 upgrade for both jobs; add Ubuntu build-test step that runs interactive TUI tests against the compiled binary artifact.
- `src/test/tui-interactive-editor-handoff.test.ts`:
  - add key-byte logging in the editor helper script.
  - send arrow input during PTY scenario and assert byte capture.
  - support running against source or compiled CLI via `TUI_TEST_CLI_PATH` and `TUI_TEST_CLI_RUNTIME` env vars.
  - keep deterministic session teardown in expect flow and tolerate expected SIGINT exit code from forced closure.

Verification executed:
- `RUN_INTERACTIVE_TUI_TESTS=1 bun test src/test/tui-interactive-editor-handoff.test.ts --timeout=30000`
- `bun test src/test/tui-edit-session.test.ts src/test/task-updated-date.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`
- `bun run build`
- `RUN_INTERACTIVE_TUI_TESTS=1 TUI_TEST_CLI_RUNTIME= TUI_TEST_CLI_PATH="$PWD/dist/backlog" bun test src/test/tui-interactive-editor-handoff.test.ts --timeout=30000`

Validated release-equivalent artifact context: `backlog.md@1.39.0` npm platform binary contains Bun `1.2.23` strings, matching workflow pinning prior to this fix.

Ran interactive PTY handoff scenarios against source CLI and compiled binaries; captured transcripts under `tmp/tui-interactive-transcripts` and repro directories during investigation.

Implemented stronger interactive regression checks to assert editor key-byte passthrough (arrow key bytes) and made harness runnable against source or compiled CLI binaries via env overrides.

Updated CI and release workflows to Bun `1.3.9` and synchronized cache keys/comments to remove obsolete 1.2.x pin rationale.

Validated `bun run build` output (`dist/backlog`) and executed interactive PTY handoff tests directly against that compiled binary path.

Post-fix merge gate run: full `bun test` now passes on this branch after normalizing `runtime-cwd` assertions to canonical real paths on macOS (`/var` vs `/private/var` symlink differences).

Final verification repeated: `bun test`, `bunx tsc --noEmit`, and `bun run check .` all pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Resolved issue #457 at the shipping/runtime layer by upgrading CI + release Bun pinning from 1.2.23 to 1.3.9 and adding stronger interactive regression checks.

What changed:
- `.github/workflows/release.yml`: Bun pin/cache keys updated to 1.3.9.
- `.github/workflows/ci.yml`: Bun pin/cache keys updated to 1.3.9 in test and build jobs.
- `.github/workflows/ci.yml`: added Ubuntu build job step to run interactive TUI handoff tests against the compiled binary artifact.
- `src/test/tui-interactive-editor-handoff.test.ts`: now verifies arrow-key byte passthrough into the editor process and can run against either source CLI or compiled binary via env overrides.

Verification highlights:
- Interactive handoff tests pass in source mode and compiled-binary mode (`dist/backlog`).
- `bun run build` succeeds and compiled artifact was validated via interactive test flow.
- Typecheck and lint/check pass.

Root-cause evidence referenced in task notes: shipped binaries were still built with Bun 1.2.23; upstream stdin pause/subprocess handoff fix is in Bun 1.3.x (oven-sh/bun#23341), and the old websocket regression concern was closed (oven-sh/bun#23536).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
