---
id: BACK-465
title: 'Config-Schema: terminalStatuses-Key einführen'
status: Done
assignee:
  - '@claude'
created_date: '2026-05-06 19:57'
updated_date: '2026-05-06 20:33'
labels: []
dependencies: []
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce optional config key terminalStatuses: string[] in the config type and loader.

Extend terminal-status.ts:
- getTerminalStatus(statuses, terminalStatuses?) — returns primary terminal status, falls back to last-element convention if terminalStatuses not set
- isTerminalStatus(status, statuses, terminalStatuses?) — returns true for any status in terminalStatuses array

Update config schema validation and type definitions.

Tests: extend terminal-status.test.ts with custom-statuses and multi-terminal scenarios.

Acceptance: boards without terminalStatuses in config behave identically to before (last-element fallback). Boards with terminalStatuses correctly recognize all listed statuses as terminal.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 - [x] terminalStatuses?: string[] field added to BacklogConfig interface
- [x] terminal_statuses key parsed in config loader (same array format as statuses)
- [x] getTerminalStatus(statuses, terminalStatuses?) returns terminalStatuses[0] when provided and non-empty
- [x] isTerminalStatus(status, statuses, terminalStatuses?) returns true for any entry in terminalStatuses
- [x] Both functions fall back to last-element convention when terminalStatuses is absent/empty (no breaking change)
- [x] All 3 existing terminal-status tests still pass
- [x] 5 new tests cover: multi-terminal match, case-insensitive match, undefined/null/empty fallback, non-last-element override
- [x] Biome check clean on all modified files
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Files to Modify

1. src/types/index.ts (BacklogConfig interface, line 283)
   - Add: terminalStatuses?: string[]  after statuses: string[]

2. src/file-system/operations.ts (parseConfig method)
   - Add case 'terminal_statuses': in switch, same array-parse pattern as 'statuses'
   - Add terminalStatuses: config.terminalStatuses to return object

3. src/utils/terminal-status.ts — extend both exported functions
   - getTerminalStatus(statuses, terminalStatuses?) — if terminalStatuses provided & non-empty, return terminalStatuses[0] (primary); else fall back to last-element convention
   - isTerminalStatus(status, statuses, terminalStatuses?) — if terminalStatuses provided & non-empty, check if status matches any entry; else use existing 2-arg logic
   - Third param optional -> all existing 2-arg call sites unaffected

4. src/test/terminal-status.test.ts — extend test suite
   - terminalStatuses override tests: multi-terminal, case-insensitive, fallback, empty array, non-last-element scenario

### Key Design Decisions
- getTerminalStatus returns terminalStatuses[0] when array provided (primary for display messages)
- isTerminalStatus returns true for ANY entry in terminalStatuses
- Backward-compatible: boards without terminalStatuses in config behave identically to before
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Files changed (4):
- src/types/index.ts — added terminalStatuses?: string[] to BacklogConfig
- src/file-system/operations.ts — added terminal_statuses case in parseConfig switch + return field
- src/utils/terminal-status.ts — extended getTerminalStatus/isTerminalStatus with optional 3rd param
- src/test/terminal-status.test.ts — added 5 new test cases in 'terminalStatuses override' describe block
Commit: f9ed42d on branch fix/back-465-terminal-statuses-config
<!-- SECTION:NOTES:END -->
