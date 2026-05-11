---
id: BACK-480
title: >-
  Complete terminalStatuses feature end-to-end: data-loss fix, full CLI/TUI/Web
  wiring, clean PR combining BACK-466/467/469/470
status: To Do
assignee: []
created_date: '2026-05-11 14:00'
labels:
  - upstream-pr
  - terminal-status
  - config
  - git-hygiene
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/635'
  - 'https://github.com/MrLesk/Backlog.md/pull/636'
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/utils/terminal-status.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/commands/
  - src/ui/enhanced-views.ts
  - src/ui/simple-unified-view.ts
  - src/ui/unified-view.ts
  - src/web/
  - src/web/lib/lanes.ts
  - src/web/lib/lanes.test.ts
  - src/test/terminal-status.test.ts
  - src/test/config-commands.test.ts
  - >-
    backlog/tasks/back-466 -
    Kern-Fix-isTerminalStatus-in-statistics.ts-handlers.ts-milestones.ts.md
  - >-
    backlog/tasks/back-467 -
    Sekundär-Fix-Aktiv-Task-Filter-auf-isTerminalStatus-umstellen.md
  - >-
    backlog/tasks/back-469 -
    Add-terminalStatuses-to-config-get-set-CLI-commands.md
  - >-
    backlog/tasks/back-470 -
    Add-missing-tests-for-BACK-467-active-filter-isTerminalStatus.md
  - AGENTS.md
  - CONTRIBUTING.md
  - .codex/skills/backlog-technical-project-manager/SKILL.md
priority: high
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PRs #635 (BACK-466: core isTerminalStatus) and #636 (BACK-467/469/470: active filters, TUI, Web) are really one feature — configurable terminal statuses end-to-end. Neither is complete without the other. Separating them creates a dependency chain that makes upstream review and merging harder. This task combines both into one clean, complete PR on upstream-master.

The upstream reviewer (Alex's Agent) on PR #635 and #636 identified the following critical gaps that must be fixed:

**Critical Bugs:**
- DATA LOSS: `terminal_statuses` is parsed from YAML by `loadConfig()` but `saveConfig()` does not write it back — saving any other config key silently drops this value. Reviewer confirmed they reproduced this bug.

**Incomplete wiring (config CLI surface):**
- `config get terminalStatuses` — missing
- `config set terminalStatuses` — missing  
- `config list` does not show `terminalStatuses` — inconsistent config surface

**Incomplete wiring (Core/CLI):**
- CLI cleanup command passes only `statuses`, not `config.terminalStatuses`
- `Core.getTerminalStatusTasksByAge()` ignores `config.terminalStatuses`

**Incomplete wiring (TUI):**
- `enhanced-views.ts` does not pass `terminalStatuses` to terminal-status helpers
- `simple-unified-view.ts` does not pass `terminalStatuses`
- `unified-view.ts` does not pass `terminalStatuses`
- Result: TUI terminal-status behavior depends on which entry point the user uses

**Incomplete wiring (Web):**
- Web board cleanup affordance derives `terminalStatus` from `getTerminalStatus(statuses)` — uses only one status, ignores configured set
- Web board lane sorting/grouping uses `terminalStatuses` (from BACK-467) but cleanup affordance does not

**Process violations (both PRs):**
- No backlog task .md files on either branch
- BACK-465 commits pollute the BACK-466 branch
- PR #636 targets main while depending on PR #635 (which is still open)

**Strategy:** Force-push to `fix/back-466-core-done-checks` (PR #635 updates in place) with complete implementation. Close PR #636 with a comment explaining it is absorbed into #635.

## Implementation Plan
1. `mcp__plugin_serena_serena__initial_instructions` — MANDATORY before any code
2. Load BACK-466, BACK-467, BACK-469, BACK-470 tasks via `mcp__backlog__task_view`
3. Run context-hunter skill: `/context-hunter`
4. `git worktree add ./worktrees/back-466-terminal-statuses upstream-master` — repo-local, NEVER /tmp
5. Activate worktree in Serena
6. Study upstream source (NOT our main): `src/types/index.ts`, `src/file-system/operations.ts`, `src/utils/terminal-status.ts`, `src/cli.ts`, `src/core/backlog.ts`
7. **TDD — write failing tests FIRST (before any implementation):**
   - Round-trip test: write `terminal_statuses` to YAML, load, save another key, load again — value must survive
   - Config CLI: `config get/set/list terminalStatuses`
   - Cleanup with a custom terminal status (not the last-status default)
   - TUI render with custom terminal status
   - Web cleanup affordance with custom terminal status
   - Lanes sorting with custom terminal status
8. **Implement — Type:** Add `terminalStatuses?: string[]` to `BacklogConfig` in `src/types/index.ts`
9. **Implement — Parse:** `loadConfig()` — parse `terminal_statuses:` YAML array into `config.terminalStatuses`
10. **Implement — Serialize (data-loss fix):** `saveConfig()` — write `terminalStatuses` back as `terminal_statuses:` YAML; handle empty array vs undefined correctly (check existing normalization pattern used for other optional array fields)
11. **Implement — Helpers:** Update `isTerminalStatus(status, statuses, terminalStatuses?)` and `getTerminalStatus(statuses, terminalStatuses?)` to use override when provided
12. **Implement — statistics.ts, handlers.ts, milestones.ts:** Replace hardcoded `'Done'`/`isDoneStatus()` with `isTerminalStatus()`; thread `terminalStatuses` through milestones call chain
13. **Implement — CLI cleanup:** Find cleanup command in `src/cli.ts` — pass `config.terminalStatuses`
14. **Implement — Core:** Update `Core.getTerminalStatusTasksByAge()` to accept and use `config.terminalStatuses`
15. **Implement — Active-task filters:** Grep for `=== 'done'` / `=== 'Done'` / hardcoded done checks in board/sequence/filter code — replace with `isTerminalStatus()`
16. **Implement — TUI wiring:** Trace config flow into `enhanced-views.ts`, `simple-unified-view.ts`, `unified-view.ts` — pass `terminalStatuses` to all terminal-status helper calls
17. **Implement — Web cleanup affordance:** Update to derive terminal statuses from `config.terminalStatuses` and show cleanup for all of them (not just one)
18. **Implement — Config CLI:** Add `terminalStatuses` to config get/set/list (in config descriptor or equivalent)
19. Verify all tests green: `bun test && bun run check . && bunx tsc --noEmit`
20. Copy task .md files for BACK-466, 467, 469, 470 to worktree; update status → In Review; add implementation notes
21. Verify: `git log upstream-master..HEAD --oneline` — no BACK-465 commits; `git diff upstream-master..HEAD --stat` — only expected files
22. Commit: `BACK-466/467/469/470 - Add terminalStatuses config with full CLI/TUI/Web wiring`
23. Force-push: `git push fork HEAD:fix/back-466-core-done-checks --force-with-lease`
24. Close PR #636 with comment: "Absorbed into PR #635 which now covers the complete terminalStatuses feature end-to-end"
25. `git worktree remove ./worktrees/back-466-terminal-statuses`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Worktree created at ./worktrees/back-466-terminal-statuses from upstream-master (NOT /tmp)
- [ ] #2 BacklogConfig has terminalStatuses?: string[] in src/types/index.ts
- [ ] #3 loadConfig() parses terminal_statuses: YAML key into config.terminalStatuses
- [ ] #4 saveConfig() serializes terminalStatuses back — round-trip test confirms no data loss when saving other config keys
- [ ] #5 isTerminalStatus() and getTerminalStatus() accept and use optional terminalStatuses override parameter
- [ ] #6 statistics.ts has no hardcoded 'Done'/isDoneStatus() — all use isTerminalStatus()
- [ ] #7 handlers.ts: isDoneStatus() removed; completeTask()/archiveTask() use isTerminalStatus()
- [ ] #8 milestones.ts: statuses + terminalStatuses threaded through call chain
- [ ] #9 CLI cleanup command passes config.terminalStatuses to all terminal-status helpers
- [ ] #10 Core.getTerminalStatusTasksByAge() uses config.terminalStatuses
- [ ] #11 Active-task filters use isTerminalStatus() not hardcoded string comparisons
- [ ] #12 TUI enhanced-views.ts passes config.terminalStatuses to terminal-status helpers
- [ ] #13 TUI simple-unified-view.ts passes config.terminalStatuses
- [ ] #14 TUI unified-view.ts passes config.terminalStatuses
- [ ] #15 Web board cleanup affordance uses config.terminalStatuses and shows cleanup for all configured terminal statuses
- [ ] #16 config get terminalStatuses works; config set terminalStatuses <val> persists; config list shows terminalStatuses key even when unset
- [ ] #17 Tests cover: round-trip parse/serialize, cleanup with custom terminal status, config CLI get/set/list, TUI behavior, Web cleanup affordance, lanes sorting
- [ ] #18 bun test passes; bun run check . passes; bunx tsc --noEmit passes
- [ ] #19 No BACK-465 commits in this branch
- [ ] #20 backlog/tasks/back-466*.md, back-467*.md, back-469*.md, back-470*.md all committed on this branch
- [ ] #21 Force-pushed to fork/fix/back-466-core-done-checks with --force-with-lease
- [ ] #22 PR #636 closed with explanation comment referencing PR #635
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
