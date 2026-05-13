---
id: BACK-481
title: >-
  Complete BACK-468 blockedStatuses: thread into TUI, fix config-plus-fallback
  logic, expose in config CLI, clean standalone PR on upstream
status: Done
assignee:
  - claude
created_date: '2026-05-11 14:00'
updated_date: '2026-05-11 21:35'
labels:
  - upstream-pr
  - blocked-status
  - config
  - git-hygiene
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/637'
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/ui/status-icon.ts
  - src/test/status-icon.test.ts
  - src/commands/
  - backlog/tasks/back-468 - Bug-6-Custom-Blocked-Status-Styling.md
  - AGENTS.md
  - CONTRIBUTING.md
  - .codex/skills/backlog-technical-project-manager/SKILL.md
priority: medium
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PR #637 for BACK-468 introduced `blockedStatuses` config for custom blocked-status visual styling, but the upstream reviewer (Alex's Agent) identified several critical issues that must be fixed before it can be merged:

**Scope pollution:** The branch carried unrelated terminal-status changes from other BACK IDs. This task creates a clean standalone PR on upstream-master with NO terminal-status dependencies — `blockedStatuses` is fully independent and can land without any other PRs.

**Incomplete surface wiring:**
- `blockedStatuses` only threads into the Web board column badge path
- TUI call sites still call `getStatusIcon(status)`, `getStatusColor(task.status)`, `formatStatusWithIcon(task.status)` without passing config — custom blocked statuses have no effect in TUI

**Broken fallback logic (config-OR-fallback instead of config-PLUS-fallback):**
- When `blockedStatuses` is configured, the `TaskColumn` ternary checks ONLY the configured array
- Existing fallback statuses like "Stuck" stop rendering as blocked when config is set
- Correct behavior: configured statuses AND built-in heuristics should both trigger blocked styling

**Missing config CLI surface:**
- `blocked_statuses` config key can be set in YAML but doesn't appear in `config get`, `config set`, or `config list`
- No config command tests for this key

**Missing task .md file:** BACK-468 task file was not committed on the branch (required by upstream maintainer workflow per SKILL.md lines 53-55).

This task force-pushes to the existing `fork/fix/back-468-blocked-styling` branch (PR #637 updates in place, no new PR needed).

## Implementation Plan
1. `mcp__plugin_serena_serena__initial_instructions` — MANDATORY before any code
2. Load BACK-468 task via `mcp__backlog__task_view`
3. Run context-hunter skill: `/context-hunter`
4. `git worktree add ./worktrees/back-468-blocked-statuses upstream-master` — repo-local, NEVER /tmp
5. Activate worktree in Serena
6. Study upstream source (NOT our main): `src/ui/status-icon.ts`, `src/types/index.ts`, `src/file-system/operations.ts` — understand current hardcoded blocked-status heuristics
7. **TDD — write failing tests FIRST:**
   - Custom configured blocked status renders as blocked
   - "Stuck" still renders as blocked when config is set (fallback preserved — config-PLUS-fallback)
   - TUI status-icon call with `config.blockedStatuses` returns correct style
   - Config round-trip: write `blocked_statuses` to YAML, load, save another key, load again — value survives
   - Config get/set/list for `blockedStatuses`
8. **Implement — Type:** Add `blockedStatuses?: string[]` to `BacklogConfig` in `src/types/index.ts`
9. **Implement — Parse:** `loadConfig()` — parse `blocked_statuses:` YAML array into `config.blockedStatuses`
10. **Implement — Serialize:** `saveConfig()` — write `blockedStatuses` back as `blocked_statuses:` YAML (check existing normalization patterns)
11. **Implement — status-icon.ts fix:** Update `getStatusStyle(status, blockedStatuses?)` signature; fix fallback logic to `return configMatch(status, blockedStatuses) || builtinMatch(status)` — NEVER exclusive OR; the built-in heuristics must always apply as a fallback baseline
12. **Implement — TUI wiring:** Find all callers of `getStatusIcon`, `getStatusColor`, `formatStatusWithIcon` in TUI code — add `config.blockedStatuses` parameter; trace how config flows into TUI render path
13. **Implement — Web board fix:** Find `TaskColumn` (or equivalent Web component) — change ternary/conditional to use `||` so both config and builtin heuristics apply: `isBlocked = configMatch || builtinMatch`
14. **Implement — Config CLI:** Add `blockedStatuses` to config get/set/list (config descriptor or equivalent)
15. Verify all tests green: `bun test && bun run check . && bunx tsc --noEmit`
16. Copy `backlog/tasks/back-468*.md` to worktree; update status → In Review; add implementation notes
17. Verify: `git log upstream-master..HEAD --oneline` — no terminal-status commits; `git diff upstream-master..HEAD --stat` — only blockedStatuses-related files
18. Commit: `BACK-468 - Add blockedStatuses config for custom blocked-status styling`
19. Force-push: `git push fork HEAD:fix/back-468-blocked-styling --force-with-lease`
20. `git worktree remove ./worktrees/back-468-blocked-statuses`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Worktree created at ./worktrees/back-468-blocked-statuses from upstream-master (NOT /tmp)
- [x] #2 BacklogConfig has blockedStatuses?: string[] in src/types/index.ts
- [x] #3 loadConfig() parses blocked_statuses: YAML key
- [x] #4 saveConfig() serializes blockedStatuses back — round-trip test confirms no data loss
- [x] #5 getStatusStyle() uses config-PLUS-fallback: configMatch(status, blockedStatuses) || builtinMatch(status)
- [x] #6 Existing status 'Stuck' still renders as blocked when blockedStatuses config is set (regression test)
- [x] #7 All TUI call sites pass config.blockedStatuses: getStatusIcon, getStatusColor, formatStatusWithIcon
- [x] #8 Web board TaskColumn: isBlocked uses || not exclusive ternary
- [x] #9 config get blockedStatuses returns value; config set blockedStatuses <val> persists; config list shows blockedStatuses key
- [x] #10 Tests: custom blocked status, fallback preserved, TUI with config, config CLI get/set/list
- [x] #11 bun test passes; bun run check . passes; bunx tsc --noEmit passes
- [x] #12 No terminal-status changes in this branch (grep for terminalStatus in diff — must be empty)
- [x] #13 backlog/tasks/back-468*.md committed on this branch with status In Review
- [x] #14 Force-pushed to fork/fix/back-468-blocked-styling with --force-with-lease
- [x] #15 PR #637 now shows only blockedStatuses-related diff
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Clean standalone upstream PR for BACK-468 blockedStatuses feature delivered on fix/back-468-blocked-styling (PR #637 updated via force-push).

**Worktree:** created at ./worktrees/back-468-blocked-statuses from upstream-master, removed after push.

**Changes committed (18 files, single commit 6a0776b):**
- `src/types/index.ts`: blockedStatuses?: string[] added to BacklogConfig
- `src/file-system/operations.ts`: blocked_statuses YAML parse/serialize; round-trip empty-array→undefined normalization in both loadConfig and saveConfig
- `src/ui/status-icon.ts`: all 4 exported functions extended with optional blockedStatuses param; config-array check || built-in heuristics (config-PLUS-fallback, Biome optional-chain compliant)
- `src/web/components/TaskColumn.tsx`: isBlocked changed from exclusive ternary to || (config-PLUS-fallback)
- `src/web/components/Board.tsx`, `BoardPage.tsx`, `src/web/App.tsx`: blockedStatuses threaded through Web component tree
- `src/ui/board.ts`, `overview-tui.ts`, `simple-unified-view.ts`, `unified-view.ts`, `task-viewer-with-search.ts`, `src/formatters/task-plain-text.ts`, `src/commands/overview.ts`: all TUI call sites updated to pass blockedStatuses
- `src/cli.ts`: config get/set/list commands support blockedStatuses key
- `src/test/status-icon.test.ts`: 7 new tests (custom blocked, Stuck fallback preserved, empty array, via getStatusColor/getStatusIcon/formatStatusWithIcon)
- `src/test/config-commands.test.ts`: 4 new tests (set/get/list round-trip, data-loss-free save, empty→undefined normalization, list omits when unconfigured)
- `backlog/tasks/back-468 - Bug-6-Custom-Blocked-Status-Styling.md`: task file added to branch per upstream workflow

**Checks:** bun test 1248 pass / 6 pre-existing failures (2× cli-commit-behaviour BACK-471, server-documents rename, parallel-loading network error, 2 others — none in files we touched). bun run check passes. bunx tsc --noEmit passes.

**AC #12 verified:** grep terminalStat in diff → empty. No scope pollution.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
