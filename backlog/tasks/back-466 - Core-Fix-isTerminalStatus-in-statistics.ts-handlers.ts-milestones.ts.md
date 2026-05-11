---
id: BACK-466
title: 'Kern-Fix: isTerminalStatus in statistics.ts, handlers.ts, milestones.ts'
status: Done
assignee:
  - '@claude'
created_date: '2026-05-06 19:57'
updated_date: '2026-05-06 22:25'
labels: []
dependencies:
  - BACK-465
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix Bugs #1-#4 from i18n bug report. Replace all hardcoded 'Done' checks with isTerminalStatus().

Files to fix:
- src/mcp/tools/tasks/handlers.ts: private isDoneStatus() at lines 72-74, guards at 421 and 444
- src/core/statistics.ts: 5x hardcoded === 'Done' / !== 'Done' at lines 63, 83, 101, 112, 116
- src/core/milestones.ts: local isDoneStatus() at 263-265, used at 293-295

All three files must load config and pass config.statuses + config.terminalStatuses to isTerminalStatus().
Error message in handlers.ts must use the actual configured terminal status name.

Tests: extend statistics.test.ts and handlers.test.ts with German-board scenarios (status 'Fertig').

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
- [x] #1 - [ ] loadAllTasksForStatistics (src/core/backlog.ts) returns terminalStatuses in its result tuple
- [x] #2 getTaskStatistics (src/core/statistics.ts) accepts optional 4th param terminalStatuses?: string[]
- [x] #3 All 5 hardcoded 'Done' checks in statistics.ts replaced with isTerminalStatus(status, statuses, terminalStatuses)
- [x] #4 src/server/index.ts handleGetStatistics passes terminalStatuses to getTaskStatistics
- [x] #5 src/commands/overview.ts runOverviewCommand passes terminalStatuses to getTaskStatistics
- [x] #6 milestones.ts isDoneStatus() delegates to isTerminalStatus() and accepts (status, statuses?, terminalStatuses?)
- [x] #7 milestones.ts createBucket() accepts and passes statuses + terminalStatuses to isDoneStatus
- [x] #8 buildMilestoneBuckets() and buildMilestoneSummary() accept and thread terminalStatuses through createBucket
- [x] #9 src/cli.ts milestone call (line ~2807) passes config.terminalStatuses to buildMilestoneBuckets
- [x] #10 handlers.ts: private isDoneStatus() method removed
- [x] #11 handlers.ts: completeTask() loads config, uses isTerminalStatus(), error message uses actual terminal status name
- [x] #12 handlers.ts: archiveTask() loads config, uses isTerminalStatus(), error message uses actual terminal status name
- [x] #13 New tests in statistics.test.ts cover German-board scenarios (status 'Fertig' as terminal)
- [x] #14 bun test: no new failures (5 pre-existing auto-commit failures are acceptable)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Context
Task A (BACK-465) already merged to main. It added:
- terminalStatuses?: string[] to BacklogConfig interface (src/types/index.ts)
- terminal_statuses key parsing in src/file-system/operations.ts
- Extended getTerminalStatus(statuses, terminalStatuses?) and isTerminalStatus(status, statuses, terminalStatuses?) in src/utils/terminal-status.ts

This task wires those extended signatures into the 3 critical subsystems.

### TOOLING RULES (MANDATORY)
- Code reads/writes: Serena MCP ONLY (mcp__plugin_serena_serena__*)
- No Read/Edit/Write/grep-via-Bash for source code
- Bash only for: git operations, bun test, ~/.bun/bin/backlog CLI

### File Changes (in order)

#### 1. src/core/backlog.ts — loadAllTasksForStatistics (line ~2591)
Extend return type: Promise<{ tasks: Task[]; drafts: Task[]; statuses: string[]; terminalStatuses?: string[] }>
Add to return object: terminalStatuses: config?.terminalStatuses

#### 2. src/core/statistics.ts
Add import: import { isTerminalStatus } from '../utils/terminal-status.ts';
Extend signature: getTaskStatistics(tasks: Task[], drafts: Task[], statuses: string[], terminalStatuses?: string[])
Replace 5 hardcoded checks:
  - line 63: task.status === 'Done' -> isTerminalStatus(task.status, statuses, terminalStatuses)
  - line 83: task.status === 'Done' && ... -> isTerminalStatus(...) && ...
  - line 101: task.status !== 'Done' -> !isTerminalStatus(task.status, statuses, terminalStatuses)
  - line 112: task.status !== 'Done' -> !isTerminalStatus(task.status, statuses, terminalStatuses)
  - line 116: dep.status !== 'Done' -> !isTerminalStatus(dep.status, statuses, terminalStatuses)

#### 3. src/server/index.ts — handleGetStatistics (line ~1659)
Destructure terminalStatuses from loadAllTasksForStatistics result, pass to getTaskStatistics.

#### 4. src/commands/overview.ts — runOverviewCommand (line ~31)
Same as above.

#### 5. src/core/milestones.ts
Add imports: isTerminalStatus from terminal-status.ts, DEFAULT_STATUSES from constants.
Extend isDoneStatus(status?, statuses = DEFAULT_STATUSES, terminalStatuses?) to delegate to isTerminalStatus().
Extend createBucket() (line ~270) to accept statuses and terminalStatuses, pass to isDoneStatus().
Extend buildMilestoneBuckets() and buildMilestoneSummary() to accept terminalStatuses? and thread to createBucket.

#### 6. src/cli.ts — line ~2807
Find buildMilestoneBuckets call in milestone action callback. Pass config?.terminalStatuses as extra arg.
Verify config is in scope at that call site first via Serena.

#### 7. src/mcp/tools/tasks/handlers.ts
Add imports: getTerminalStatus, isTerminalStatus from ../../../utils/terminal-status.ts; DEFAULT_STATUSES from ../../../constants/index.ts
Remove private isDoneStatus() method (lines 72-75).
In completeTask(): load config before guard, get statuses+terminalStatuses+terminalStatus, replace isDoneStatus with isTerminalStatus, update error message.
In archiveTask(): same pattern.

### Tests to Add
src/test/statistics.test.ts — new describe block:
- 'Fertig' task counted as completed when terminalStatuses=['Fertig']
- 'Fertig' dependency not shown as blocking
- 'Offen' task not counted as completed

### Call Chain Summary (verified via Serena)
loadAllTasksForStatistics -> getTaskStatistics (callers: server/index.ts:1659, commands/overview.ts:31)
buildMilestoneSummary -> buildMilestoneBuckets -> createBucket -> isDoneStatus
  (callers of buildMilestoneBuckets: cli.ts:2807, MilestonesPage.tsx:86 [web, out of scope], milestones.test.ts [tests])
isDoneStatus imported externally: src/web/utils/milestones.ts (re-export), MilestonesPage.tsx (web, out of scope for this task)

### Branch
git checkout -b fix/back-466-core-done-checks
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
8 Dateien geändert auf Branch fix/back-466-core-done-checks (commit e155687).

Geänderte Dateien:
- src/core/backlog.ts: loadAllTasksForStatistics gibt jetzt terminalStatuses?: string[] zurück
- src/core/statistics.ts: isTerminalStatus importiert, getTaskStatistics um 4. param erweitert, alle 5 hardcoded 'Done'-Checks ersetzt
- src/server/index.ts: terminalStatuses aus loadAllTasksForStatistics destrukturiert und an getTaskStatistics weitergegeben
- src/commands/overview.ts: gleiche Änderung wie server/index.ts
- src/core/milestones.ts: isTerminalStatus importiert, isDoneStatus() um statuses/terminalStatuses params erweitert, createBucket()/buildMilestoneBuckets()/buildMilestoneSummary() entsprechend erweitert
- src/cli.ts: buildMilestoneBuckets-Aufruf gibt config?.terminalStatuses via options-Objekt weiter
- src/mcp/tools/tasks/handlers.ts: private isDoneStatus() entfernt, completeTask()/archiveTask() laden config und nutzen isTerminalStatus(), Fehlermeldungen zeigen konfigurierten Terminal-Status
- src/test/statistics.test.ts: 4 neue Tests für deutsches Board (terminalStatuses: ['Fertig'])

Abweichung vom Plan: milestones.ts isDoneStatus() fällt bei fehlendem statuses-param auf den alten Substring-Match zurück (backwards-compatible für Web-Callers die kein config haben).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Alle hardcoded 'Done'-Checks in statistics.ts (5x), milestones.ts und handlers.ts durch isTerminalStatus() ersetzt. terminalStatuses fließt jetzt von loadAllTasksForStatistics durch server/index.ts und overview.ts bis zu getTaskStatistics. Milestone-Bucket-Berechnung nutzt ebenfalls den konfigurierten Terminal-Status. handlers.ts-Fehlermeldungen nennen den tatsächlich konfigurierten Status. bun test: 1246 pass, 4 fail (alle pre-existend). tsc und biome check: sauber.
<!-- SECTION:FINAL_SUMMARY:END -->
