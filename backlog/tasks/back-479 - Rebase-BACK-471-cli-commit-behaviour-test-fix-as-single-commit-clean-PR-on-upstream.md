---
id: BACK-479
title: >-
  Rebase BACK-471 cli-commit-behaviour test fix as single-commit clean PR on
  upstream
status: To Do
assignee: []
created_date: '2026-05-11 14:00'
labels:
  - upstream-pr
  - tests
  - git-hygiene
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/638'
  - src/test/cli-commit-behaviour.test.ts
  - >-
    backlog/tasks/back-471 -
    Fix-CLI-auto-commit-for-doc-decision-task-create-commands.md
  - AGENTS.md
  - CONTRIBUTING.md
priority: high
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PR #638 was submitted as a one-line test fix (change `git rev-list --all --count` to `git rev-list --count HEAD` in cli-commit-behaviour.test.ts to avoid non-deterministic count mismatches caused by refs/notes/ai). However, the branch accidentally carried unrelated terminal-status changes from BACK-466/467. The upstream reviewer (Alex's Agent) asked to split it so the PR contains only the test-fix commit.

Additionally the PR was missing the backlog task .md file on the branch, which is required by the upstream maintainer's workflow (SKILL.md lines 53-55: "Sub-agents must update task records on their own task branch as part of their task delivery").

This task creates a clean branch on upstream-master with only the single relevant change, commits the BACK-471 task .md file, and force-pushes to the existing fork branch so PR #638 updates in place (no new PR, no lost review history).

## Implementation Plan
1. `mcp__plugin_serena_serena__initial_instructions` — MANDATORY before any code
2. Load BACK-471 task via `mcp__backlog__task_view`
3. `git worktree add ./worktrees/back-471-test-fix upstream-master` — use repo-local worktrees, NEVER /tmp
4. Activate worktree in Serena
5. Apply the single-line change in `src/test/cli-commit-behaviour.test.ts`: change `git rev-list --all --count` to `git rev-list --count HEAD`
6. Copy `backlog/tasks/back-471*.md` to worktree, update status to In Review, add implementation notes
7. Run `bun test src/test/cli-commit-behaviour.test.ts && bun run check .`
8. Commit: `BACK-471 - Fix cli-commit-behaviour tests using git rev-list --count HEAD`
9. Verify: `git log upstream-master..HEAD --oneline` shows exactly one commit; `git diff upstream-master..HEAD --stat` shows exactly two files (test file + task .md)
10. Force-push: `git push fork HEAD:fix/back-471-cli-commit-behaviour-tests --force-with-lease`
11. Post review reply on PR #638 explaining the cleanup
12. `git worktree remove ./worktrees/back-471-test-fix`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Worktree created at ./worktrees/back-471-test-fix from upstream-master (NOT /tmp)
- [ ] #2 Only src/test/cli-commit-behaviour.test.ts changed in source (one line: git rev-list --count HEAD)
- [ ] #3 No other source files in the diff (no operations.ts, types/index.ts, terminal-status.ts, etc.)
- [ ] #4 bun test src/test/cli-commit-behaviour.test.ts passes
- [ ] #5 bun run check . passes
- [ ] #6 backlog/tasks/back-471*.md committed on this branch with status In Review and implementation notes
- [ ] #7 git log upstream-master..HEAD --oneline shows exactly one commit
- [ ] #8 Force-pushed to fork/fix/back-471-cli-commit-behaviour-tests with --force-with-lease
- [ ] #9 PR #638 now shows only the single-file diff
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
