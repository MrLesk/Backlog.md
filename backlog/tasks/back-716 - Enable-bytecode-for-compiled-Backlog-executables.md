---
id: BACK-716
title: Enable bytecode for compiled Backlog executables
status: Done
assignee:
  - '@Codex'
created_date: '2026-10-11 10:12'
updated_date: '2026-10-11 10:17'
labels: []
dependencies:
  - BACK-715
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1074'
  - scripts/build.ts
  - DEVELOPMENT.md
modified_files:
  - scripts/build.ts
  - DEVELOPMENT.md
type: chore
ordinal: 338000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Compile standalone executables with Bun 1.4.3 ESM bytecode to reduce startup cost. Preserve the JavaScript bundle path used by Nix and integration tests, and record the size tradeoff.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Standalone executables use ESM bytecode and retain embedded version, browser assets, and MCP behavior.
- [x] #2 BACKLOG_BUILD_OUTDIR still emits runnable JavaScript and assets without bytecode compilation.
- [x] #3 Compiled smoke, bundle integration, and startup/size comparisons verify the change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Set ESM format and bytecode only in the compile branch of the existing Bun build.
2. Document the standalone startup/size tradeoff and unchanged bundle build path.
3. Smoke-test CLI, embedded browser assets, MCP, and the JavaScript bundle; compare startup with the upgraded non-bytecode executable.
4. Open a small draft PR stacked above the Bun/dependency upgrade.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Standalone builds now set format esm and bytecode true inside the existing compile branch. The outdir branch is unchanged. TypeScript, Biome, diff checks, and compiled CLI/browser/MCP smoke pass. The JavaScript bundle runs and passes 38 existing instruction/task-list integration tests.
Startup comparison on macOS arm64, Bun 1.4.3, latest dependencies, 21 measured warm runs after 3 warmups, alternating build order: version median 43.17 to 16.67 ms; help 46.60 to 17.93 ms; instructions overview 48.53 to 19.43 ms; task list 52.21 to 20.54 ms. Executable size 80,323,826 to 87,225,842 bytes (+8.6%). Fixture has one task; these are local startup measurements, not broad workload claims.
Subtraction review: two build options in the existing compile branch are sufficient. No new helper, build path, or regression test that duplicates the smoke coverage was added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enabled ESM bytecode for standalone executables while preserving the non-compile JavaScript bundle path. CLI, embedded browser assets, MCP, 38 bundle integration tests, TypeScript, and Biome pass. Local warm short-command startup improved from 43–52 ms to 17–21 ms; executable size increased 8.6%. Documented the tradeoff in DEVELOPMENT.md.
<!-- SECTION:FINAL_SUMMARY:END -->
