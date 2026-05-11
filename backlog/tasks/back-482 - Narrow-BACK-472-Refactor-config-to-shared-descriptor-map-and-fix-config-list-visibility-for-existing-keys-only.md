---
id: BACK-482
title: >-
  Narrow BACK-472: Refactor config to shared descriptor map and fix config list
  visibility for existing keys only
status: To Do
assignee: []
created_date: '2026-05-11 14:00'
updated_date: '2026-05-11 14:01'
labels:
  - upstream-pr
  - config
  - refactor
  - git-hygiene
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/639'
  - src/commands/
  - src/file-system/operations.ts
  - AGENTS.md
  - CONTRIBUTING.md
priority: low
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PR #639 for BACK-472 introduced a `CONFIG_DESCRIPTORS` map as a single source of truth for config handling and tried to add `terminalStatuses`/`blockedStatuses` to the config surface. The upstream reviewer (Alex's Agent) said: the new keys appear in CLI but aren't wired into actual behavior, making them look supported when they aren't. Recommendation: narrow the PR to fields that already have real behavior.

Since separate tasks handle the complete wiring for `terminalStatuses` (BACK-480) and `blockedStatuses` (BACK-481), this task narrows PR #639 to:
1. Introduce the `CONFIG_DESCRIPTORS` refactor for **existing keys only** 
2. Fix `config list` to consistently show all existing supported config keys even when unset (currently some optional keys are silently hidden)
3. Keep the descriptor map designed for trivial extensibility — adding new keys like `terminalStatuses`/`blockedStatuses` should be a one-liner once those PRs land

This task force-pushes to `fork/fix/back-472-config-list-descriptor-map` (PR #639 updates in place, no new PR needed). The BACK-472 task .md file must be committed on the branch.

## Implementation Plan
1. `mcp__plugin_serena_serena__initial_instructions` — MANDATORY before any code
2. Load BACK-472 task via `mcp__backlog__task_view`
3. `git worktree add ./worktrees/back-472-config-descriptor upstream-master` — repo-local, NEVER /tmp
4. Activate worktree in Serena
5. Study upstream's current config command implementation: understand what keys exist, how `config get/set/list` currently work, which optional keys are hidden when unset
6. **TDD — write failing test FIRST:** `config list` output includes all existing config keys with a visible `(not set)` or `—` indicator for unset optional fields
7. Define `CONFIG_DESCRIPTORS` map (or equivalent): each entry contains key name, display label, description, default value, parser function, serializer function — for all currently supported keys only
8. Refactor `config get`, `config set`, `config list` to derive behavior from the map
9. Fix `config list` output: iterate all descriptor entries, show unset optional fields with clear indicator (not hidden)
10. Do NOT add `terminalStatuses` or `blockedStatuses` to the map in this PR
11. Verify tests green: `bun test && bun run check .`
12. Copy `backlog/tasks/back-472*.md` to worktree; update status → In Review; add implementation notes
13. Add note to PR description: "Designed to be extended with terminalStatuses/blockedStatuses entries once BACK-466 (PR #635) and BACK-468 (PR #637) are merged — adding them will be a one-liner in the descriptor map"
14. Verify: `git log upstream-master..HEAD --oneline` — only BACK-472 commits; `git diff upstream-master..HEAD --stat` — only config-related files
15. Commit: `BACK-472 - Refactor config to shared descriptor map, fix config list visibility`
16. Force-push: `git push fork HEAD:fix/back-472-config-list-descriptor-map --force-with-lease`
17. `git worktree remove ./worktrees/back-472-config-descriptor`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Worktree created at ./worktrees/back-472-config-descriptor from upstream-master (NOT /tmp)
- [ ] #2 CONFIG_DESCRIPTORS map (or equivalent) defined for all currently-supported config keys
- [ ] #3 config list shows all existing config keys — no silent omissions
- [ ] #4 config list shows unset optional keys with visible empty/default indicator (not hidden)
- [ ] #5 config get and config set behavior consistent with descriptor map
- [ ] #6 No terminalStatuses or blockedStatuses entries in descriptor map in this PR
- [ ] #7 PR description notes extensibility for terminalStatuses/blockedStatuses once related PRs land
- [ ] #8 Tests for config list showing all keys including unset optional ones
- [ ] #9 bun test passes; bun run check . passes
- [ ] #10 backlog/tasks/back-472*.md committed on this branch with status In Review
- [ ] #11 Force-pushed to fork/fix/back-472-config-list-descriptor-map with --force-with-lease
- [ ] #12 PR #639 now shows only config-refactor-related diff
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
