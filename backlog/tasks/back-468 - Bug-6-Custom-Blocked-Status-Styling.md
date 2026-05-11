---
id: BACK-468
title: 'Bug #6: Custom Blocked-Status Styling'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-05-06 19:59'
updated_date: '2026-05-11 21:28'
labels: []
dependencies:
  - BACK-465
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix hardcoded 'Blocked' styling in status-icon.ts and TaskColumn.tsx.

Add optional config key blockedStatuses: string[] (analogous to terminalStatuses).

Files to fix:
- src/ui/status-icon.ts: hardcoded exact-match 'Blocked' key in statusMap
- src/web/components/TaskColumn.tsx:88: includes('blocked') || includes('stuck') substring check

Fix strategy:
- Add blockedStatuses?: string[] to config type
- Pass config into getStatusStyle() and badge-class helper
- Check if status matches any configured blockedStatuses
- Fallback: keep includes('blocked')/includes('stuck') heuristic for English boards

Tests: extend status-icon.test.ts with custom blocked-status scenarios.

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
- [x] #1 - [ ] src/types/index.ts: blockedStatuses?: string[] added to BacklogConfig
- [x] #2 src/file-system/operations.ts: blocked_statuses key parsed in parseConfig (same array pattern as statuses)
- [x] #3 src/ui/status-icon.ts: hardcoded 'Blocked' exact-match replaced with config-aware check using blockedStatuses
- [x] #4 src/ui/status-icon.ts: fallback heuristic includes('blocked') preserved for English boards
- [x] #5 src/web/components/TaskColumn.tsx: badge-class logic updated to check blockedStatuses from config
- [x] #6 src/web/components/TaskColumn.tsx: fallback includes('blocked')/includes('stuck') preserved for English boards
- [x] #7 New tests in status-icon.test.ts cover custom blocked-status scenarios
- [x] #8 bun test: no new failures
- [x] #9 Tests written and failing (RED) before any implementation starts — run bun test to confirm
- [x] #10 bun run check . passes on all modified files
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Context
BACK-465 introduced terminalStatuses config infrastructure (already on main).
This task adds analogous blockedStatuses support for visual blocked-status styling.

Two completely independent concepts:
1. Status name is 'Blocked' → visual styling (red icon/badge) [THIS TASK]
2. Task has unresolved dependencies → statistics blockedTasks count [fixed in BACK-466]

### Tooling Rules (mandatory)
- Code reads/writes: Serena MCP ONLY (mcp__plugin_serena_serena__*)
- No Read/Edit/Write/grep-via-Bash for source code
- Bash only for: git operations, bun test, ~/.bun/bin/backlog CLI

### Branch
git checkout -b fix/back-468-blocked-styling

---

### Phase RED — Write failing tests first (before any implementation)

1. Read src/test/status-icon.test.ts via Serena to understand existing structure and imports
2. Add describe block: "blockedStatuses config override"
   - Test 1 (custom status): status 'Gesperrt' is styled as blocked when blockedStatuses=['Gesperrt']
   - Test 2 (English fallback): 'Blocked' still styled correctly when blockedStatuses not configured
   - Test 3 (edge case): empty blockedStatuses array falls back to substring heuristic (includes('blocked'))
3. Run `bun test src/test/status-icon.test.ts` — must FAIL (RED confirmed, check AC #9)

### Phase GREEN — Implement minimal code to make tests pass

#### 1. src/types/index.ts
Add blockedStatuses?: string[] to BacklogConfig (after terminalStatuses?: string[])

#### 2. src/file-system/operations.ts — parseConfig
Add case 'blocked_statuses': (same array pattern as 'terminal_statuses')
Add blockedStatuses: config.blockedStatuses to return object

#### 3. src/ui/status-icon.ts
- Read full file via Serena first to understand current API and all callers
- Find all call sites with mcp__plugin_serena_serena__find_referencing_symbols
- Extend function signature to accept config (or blockedStatuses?: string[])
- Logic: if blockedStatuses provided and non-empty → check if status matches any entry (case-insensitive)
- Fallback: if no blockedStatuses configured → keep existing includes('blocked') substring heuristic

#### 4. src/web/components/TaskColumn.tsx — line ~88
- Read component via Serena to understand how statuses/config are passed (likely props or context)
- Extend badge-class logic: check blockedStatuses from config first, fallback to includes('blocked')/includes('stuck')
- Find how to thread blockedStatuses through the prop chain if needed

#### 5. Run `bun test` — must PASS (GREEN confirmed)

### Phase REFACTOR
- Review all changes for simplification opportunities
- Ensure no duplication with the terminalStatuses implementation pattern
- Run `bun run check .` and `bunx tsc --noEmit` — must be clean

### Investigation Steps (use Serena before editing)
For src/ui/status-icon.ts:
1. mcp__plugin_serena_serena__read_file to see exact current code
2. mcp__plugin_serena_serena__find_referencing_symbols to find all callers
3. Understand how to add config param without breaking existing callers

For src/web/components/TaskColumn.tsx:
1. mcp__plugin_serena_serena__read_file around line 88
2. Check how TaskColumn receives statuses/config currently
3. Determine where blockedStatuses should come from in the component tree
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prepared as clean standalone upstream PR on fix/back-468-blocked-styling (PR #637).
All scope pollution removed (terminal-status commits not included).
Full implementation: types, YAML parse/serialize, status-icon TUI wiring, Web board fix, config CLI surface.
Tests: 11 new tests (7 status-icon, 4 config-commands). bun run check + bunx tsc clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added blockedStatuses?: string[] config key, analogous to terminalStatuses. Parses/serializes blocked_statuses from config.yml. status-icon.ts now checks blockedStatuses array first, falls back to exact-match 'Blocked' and substring heuristic for English boards. Config threaded from App.tsx down through BoardPage → Board → TaskColumn so the web UI badge-class logic is also config-aware with the same fallback. 3 new TDD tests (RED confirmed before implementation). All checks clean: bun test (3 new passing, 5 pre-existing failures unchanged), bunx tsc --noEmit, bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
