---
id: BACK-806
title: Write board export to the absolute path the user gives
status: Done
assignee:
  - '@batou9150'
created_date: '2026-11-17T15:24:00Z'
updated_date: '2026-11-17T16:18:00Z'
labels:
  - bug
  - cli
dependencies: []
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Running `backlog board export /tmp/out/board.md` from a project writes `<project>/tmp/out/board.md` and reports that path as the export location. The command joins every filename onto the project root, so an absolute destination (for example a CI artifacts directory outside the repository) is silently redirected into the repository and leaves stray directories there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An absolute filename writes the board to that exact path and the success message names it
- [x] #2 A relative filename still resolves against the project root, and omitting it still writes Backlog.md there
- [x] #3 The --readme export still updates README.md in the project root
- [x] #4 A CLI test covers the absolute and relative destinations
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce with a CLI test that exports to an absolute path outside the project and to a relative path inside it.
2. In the board export command (src/cli.ts), resolve the filename against the project root with path.resolve instead of path.join, so absolute paths are kept and relative paths keep their current meaning.
3. Leave the --readme branch unchanged; it does not use the filename.
4. Run types, Biome, focused board/README tests and the full suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The new CLI test failed before the fix: the export landed at <project>/<absolute path> and the success line printed that joined path. It passes after the fix. --readme, the default Backlog.md and a relative path were also checked by hand on a temporary project; all still resolve against the project root.

Local environment: the full suite (3712 pass, 53 fail) has failures outside board export only. They are 10s timeouts in auto-commit tests, which also fail on unmodified main (commit-failure-after-change.test.ts: 17/17), plus scripts/update-nix.test.cjs, which needs patched Node 26.12.1+ (local Node 22). Focused board, README and doctor tests pass (72/72); types and Biome are clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
board export now resolves its filename with path.resolve against the project root instead of path.join. An absolute destination is written where the user asked, and the success message names it; relative names and the default Backlog.md keep their meaning, and --readme is unchanged. A CLI test covers an absolute destination outside the project and a relative one inside it. Windows drive-letter paths go through the same Node path.resolve but were not run on Windows locally.
<!-- SECTION:FINAL_SUMMARY:END -->
