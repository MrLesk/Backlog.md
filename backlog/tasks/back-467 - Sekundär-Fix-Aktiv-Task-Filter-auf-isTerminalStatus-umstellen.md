---
id: BACK-467
title: 'Sekundär-Fix: Aktiv-Task-Filter auf isTerminalStatus umstellen'
status: Done
assignee:
  - '@claude'
created_date: '2026-05-06 19:59'
updated_date: '2026-05-06 22:07'
labels: []
dependencies:
  - BACK-465
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix secondary 'done' checks used for active-task filtering. Replace all .toLowerCase() !== 'done' filters with isTerminalStatus().

Files to fix:
- src/core/backlog.ts:1955, 1971, 1990 (sequence reorder active task filter)
- src/cli.ts:3348 (active task filter for sequence display)
- src/ui/sequences.ts:420 (active task filter in TUI sequences view)
- src/ui/board.ts:50-52 (TUI board done-column detection)
- src/web/lib/lanes.ts:206 (web board lane done-status detection)

Load config and pass statuses + terminalStatuses to isTerminalStatus() in each location.

Tests: verify existing filter tests still pass; add custom-status scenarios.

Depends on: Task A (BACK-465)
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 - [ ] src/core/backlog.ts: 3x .toLowerCase() !== 'done' filters (lines ~1955, 1971, 1990) replaced with !isTerminalStatus()
- [x] #2 src/cli.ts: 1x .toLowerCase() !== 'done' filter (line ~3348) replaced with !isTerminalStatus()
- [x] #3 src/ui/sequences.ts: 1x .toLowerCase() !== 'done' filter (line ~420) replaced with !isTerminalStatus()
- [x] #4 src/ui/board.ts: done-column detection (lines ~50-52) replaced with isTerminalStatus()
- [x] #5 src/web/lib/lanes.ts: lane done-status detection (line ~206) replaced with isTerminalStatus()
- [x] #6 Each change loads config and passes statuses + terminalStatuses to isTerminalStatus()
- [x] #7 bun test: no new failures
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Context
Task A (BACK-465) and Task B (BACK-466) must be merged to main first.
This task fixes secondary active-task filters that still use .toLowerCase() !== 'done'.

### TOOLING RULES (MANDATORY)
- Code reads/writes: Serena MCP ONLY
- Bash only for: git, bun test, ~/.bun/bin/backlog

### Files to Fix

#### src/core/backlog.ts — lines ~1955, 1971, 1990
Three .toLowerCase() !== 'done' filters in sequence reorder logic.
Load config, get statuses + terminalStatuses, replace with !isTerminalStatus(task.status, statuses, terminalStatuses).
Check if config is already loaded in those call sites; if so, reuse it.

#### src/cli.ts — line ~3348
Active task filter for sequence display. Same pattern.

#### src/ui/sequences.ts — line ~420
Active task filter in TUI sequences view.
Find how config/statuses are obtained in this file and follow same pattern.

#### src/ui/board.ts — lines ~50-52
TUI board done-column detection. Pattern: normalized === 'done' || normalized === 'completed' || normalized === 'complete'.
Replace with isTerminalStatus(status, statuses, terminalStatuses).

#### src/web/lib/lanes.ts — line ~206
Web board lane done-status detection. Pattern: .includes('done') || .includes('complete').
Replace with isTerminalStatus(status, statuses, terminalStatuses).
Note: this is a web utility — check how statuses are passed in this file (likely from a hook/context).

### Investigation Steps (use Serena before editing)
For each file:
1. mcp__plugin_serena_serena__read_file to see exact current code and context
2. Find how config/statuses are obtained in scope
3. Add config load if not present, or reuse existing config/statuses variable
4. Replace the filter

### Branch
git checkout -b fix/back-467-active-filters
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed 9 files: src/core/backlog.ts (listActiveSequences + moveTaskInSequences), src/cli.ts (sequence list handler), src/ui/sequences.ts (runSequencesView reload filter), src/ui/board.ts (isDoneStatus removed → isTerminalStatus, buildColumnTasks/prepareBoardColumns signatures extended), src/web/lib/lanes.ts (sortTasksForStatus/groupTasksByLaneAndStatus signatures extended), src/web/components/Board.tsx + BoardPage.tsx + App.tsx (terminalStatuses prop chain).
<!-- SECTION:NOTES:END -->
