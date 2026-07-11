---
id: BACK-535.1
title: Replace simulated CLI tests with real surface coverage
status: In Progress
assignee:
  - '@test-hygiene-slice-a'
created_date: '2026-07-11 08:52'
updated_date: '2026-07-11 09:11'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/757'
parent_task_id: BACK-535
priority: high
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove false assurance from tests that synthesize CLI behavior through Core or hard-coded platform output. Tests named for the CLI must execute the actual CLI in isolated projects. Retire the repository-dependent priority-filter suite only after naming and retaining its public-contract replacements. This task changes tests and test utilities only; product behavior is out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every consumer of simulated CLI output in test-helpers.ts is mapped to retained domain coverage or a real CLI subprocess test
- [x] #2 Actual CLI subprocess tests cover both dependency flags (--dep and --depends-on), parent shorthand (-p), and task shortcut behavior on isolated projects
- [x] #3 Windows test paths execute the real CLI and never return hard-coded help or command output
- [x] #4 The repository-dependent cli-priority-filtering suite is removed or rewritten; priority filtering, sorting, validation, casing, composition, and plain indicators remain covered by named isolated tests
- [x] #5 No production source behavior changes
- [ ] #6 Focused tests, repeated stress runs, full tests, typecheck, Biome, and build pass, with before/after runtime and test-count deltas recorded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Map test-helpers consumers and named replacement coverage.
2. Convert missing public CLI cases to isolated real subprocess tests.
3. Reclassify retained Core tests and remove the simulated helper surface.
4. Remove or consolidate repository-dependent priority tests against named replacements.
5. Run focused stress, full/static/build verification, record runtime delta, and complete sequential specification and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Slice A without production changes. Deleted the simulated test-helpers.ts surface and converted every consumer: cli-dependency now runs the real CLI for --dep, --depends-on, repeated flags, edit, view, and validation; cli-parent-shorthand runs real -p and help; implementation plan/notes edits run real CLI; cli.test uses real -s and task shortcut commands. Deleted cli-priority-filtering.test.ts because it ran against the repository and duplicated named isolated coverage in cli.test.ts, cli-task-type.test.ts, priority.test.ts, task-sorting.test.ts, and cli-search-command.test.ts.

Verification: changed focused suites passed 5 consecutive runs (11/11 each, 0 failures; 5.53s to 6.34s). Full isolated suite: 1,623 pass, 2 intentional interactive-TUI skips, 0 fail, 1,625 total across 188 files in 160.66s. Baseline was 1,645 tests across 189 files in 184.87s, so 20 redundant/misleading tests and one file were removed while runtime fell 24.21s (13.1%). bunx tsc --noEmit, bun run check . (322 files), bun run build, and git diff --check pass.

Quality review requested restoration of CLI help discoverability coverage for --dod and --no-dod-defaults plus an explicit help exit-code assertion. Added all three assertions to the real subprocess test. Post-fix verification: parent shorthand/help passed 5 consecutive runs; Definition of Done CLI passed 5/5; TypeScript, focused Biome, and diff checks pass.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
