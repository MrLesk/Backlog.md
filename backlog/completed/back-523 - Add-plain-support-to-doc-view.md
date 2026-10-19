---
id: BACK-523
title: Add plain support to doc view
status: Done
assignee:
  - '@gpt-5'
created_date: '2026-07-08 20:15'
updated_date: '2026-07-08 20:16'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/723'
  - 'https://github.com/MrLesk/Backlog.md/pull/729'
modified_files:
  - src/cli.ts
  - src/test/cli-doc-view.test.ts
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a non-interactive plain-text path for `backlog doc view` so agents, scripts, pipes, and CI can read Backlog documents through the public CLI without launching the interactive viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog doc view <docId> --plain` prints the document content to stdout without launching the interactive viewer
- [x] #2 `backlog doc view <docId>` automatically emits plain output when stdout is not a TTY
- [x] #3 `backlog doc view --help` documents the `--plain` option and includes a plain-output example
- [x] #4 Focused CLI tests cover explicit plain output and non-TTY auto-plain behavior for document view
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Follow the existing CLI plain-output pattern used by other read commands.
2. Add `--plain` to `backlog doc view`, using `isPlainRequested(options) || shouldAutoPlain` before falling back to the scrollable viewer.
3. Update the command help schema and examples.
4. Add focused CLI tests for explicit `--plain` and non-TTY auto-plain behavior.
5. Verify with focused tests, typecheck, and Biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created after PR #729 implementation review to attach the required Backlog task record to the existing scoped GitHub issue #723 and PR.

Verification on PR #729 branch:
- `bun test src/test/cli-doc-view.test.ts` passed (2 tests).
- `bunx tsc --noEmit` passed.
- `bun run check .` passed.
- `bun run cli doc view --help` shows `--plain` and the `backlog doc view doc-1 --plain` example.
- Full `bun test` was attempted; it hit the existing `src/test/cli-priority-filtering.test.ts` timeout in `case insensitive priority filtering`, which also reproduces when that unrelated file is run alone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `--plain` support to `backlog doc view`, including non-TTY auto-plain behavior and command help/schema documentation. Verified with the focused doc-view CLI test, TypeScript check, Biome check, and help output inspection. Full-suite verification was attempted, but an unrelated priority-filtering timeout reproduces outside this PR scope.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
