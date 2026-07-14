---
id: BACK-432
title: Parse definition_of_done with standard YAML semantics
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-04-25 17:31'
labels:
  - config
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/599'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #599: config loading misparses definition_of_done values containing commas or empty block sequence entries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Quoted commas in flow-style definition_of_done entries are preserved as part of one checklist item.
- [x] #2 Block-style definition_of_done sequences parse consistently, including empty or blank-line-adjacent lists.
- [x] #3 CLI, MCP, and Web settings use the same config parse behavior.
- [x] #4 Regression tests cover the issue's repro config examples.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Context-hunter classification: L2 shared config semantics.

Implementation plan:
1. Keep the fix in the shared FileSystem config loader so CLI, MCP, and Web all consume the same parsed definitionOfDone values.
2. Parse definition_of_done with YAML semantics, preserving quoted commas and supporting block-style sequences, while keeping the existing config shape and normalization behavior.
3. Remove the temporary MCP comma rejection now that save/load can round-trip comma-bearing defaults.
4. Add focused regression tests for the issue #599 flow-style and block-style repros, including task creation from parsed defaults and MCP upsert with commas.
5. Run targeted tests first, then type-check and Biome check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery: issue #599 reproduces in FileSystem.parseConfig, which manually splits flow arrays by comma and ignores block-style definition_of_done. CLI, MCP, and Web read config through FileSystem.loadConfig(), so the fix belongs there. MCP had a comma rejection added as a corruption guard; that should be removed once YAML parsing is fixed.

Verification: focused DoD regression tests passed, full bun test passed, and bunx tsc --noEmit passed before merge. After later package formatting cleanup landed on main, project-wide bun run check . now exits successfully with existing optional-chain warnings only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Fixed definition_of_done config parsing to use standard YAML semantics for comma-bearing flow arrays and block-style lists.
- Kept CLI, MCP, and Web settings on the shared config loader behavior.
- Covered the issue #599 repro cases with regression tests.

Validation:
- Focused DoD regression tests
- bun test
- bunx tsc --noEmit
- bun run check . on current main
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
