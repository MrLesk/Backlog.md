---
id: BACK-507.13
title: Restore colorized root command splash for TTY output
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 22:40'
updated_date: '2026-06-13 22:41'
labels: []
dependencies: []
modified_files:
  - src/ui/root-entry.ts
  - src/test/cli-root-entry.test.ts
parent_task_id: BACK-507
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restore color to the bare `backlog` root command without making it a TUI. ANSI color should be emitted only for interactive terminal output, while non-TTY output, pipes, tests, redirects, CI-style runs, and `NO_COLOR` remain plain text without escape sequences.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare `backlog` root output can render the ASCII splash and section labels with ANSI color when color is explicitly enabled or stdout is an interactive TTY.
- [x] #2 Bare `backlog` root output remains plain text with no ANSI escape sequences for non-TTY output and when `NO_COLOR` is set.
- [x] #3 Tests cover color-enabled formatter output and preserve existing non-TTY root command behavior.
- [x] #4 No TUI or interactive dependency is introduced for the root command.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep `formatRootEntry` as the single root output renderer and add an optional color flag that wraps only the logo/title/section labels with ANSI colors.
2. Have `printRootEntry` enable color only when `process.stdout.isTTY` is true and `NO_COLOR` is not set.
3. Preserve existing non-TTY root command behavior and tests that assert no escape sequences in captured output.
4. Add formatter-level tests for explicit color on/off, then run the root-entry test, type-check, and Biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Restored ANSI color as a presentation-only option for root command output. `printRootEntry` now enables color only for interactive TTY stdout when `NO_COLOR` is not set. Formatter tests cover explicit color enabled/disabled, and existing CLI root-entry tests continue to verify captured non-TTY output has no escape sequences. The root task example also uses configured task-prefix rendering through the existing helper.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored color for the bare `backlog` root entry without turning it into a TUI.

Changes:
- Added optional color rendering for the ASCII logo, title, and section headings.
- `printRootEntry` enables color only when stdout is an interactive TTY and `NO_COLOR` is not set.
- Captured/non-TTY output remains plain text with no ANSI escapes.
- Added tests for color-enabled and color-disabled formatter output, while preserving existing root command behavior.
- Routed the root task example through configured task-prefix rendering.

Verification:
- `bun test src/test/cli-root-entry.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`
- Manual `NO_COLOR=1 bun src/cli.ts` check showed plain output.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
