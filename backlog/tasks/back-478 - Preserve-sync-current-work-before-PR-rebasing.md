---
id: BACK-478
title: Preserve & sync current work before PR rebasing
status: In Progress
assignee:
  - '@claude'
created_date: '2026-05-11 14:00'
updated_date: '2026-05-11 14:03'
labels:
  - process
  - git
  - upstream-pr
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/635'
  - 'https://github.com/MrLesk/Backlog.md/pull/636'
  - 'https://github.com/MrLesk/Backlog.md/pull/637'
  - 'https://github.com/MrLesk/Backlog.md/pull/638'
  - 'https://github.com/MrLesk/Backlog.md/pull/639'
priority: high
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before rebasing any of the upstream PR branches on upstream-master, all current local work must be committed and synced to the fork. Several backlog task .md files are currently untracked in the working directory and need to be committed to local main. The fork/main also needs to be pushed to match local main. This ensures no work is lost when worktrees are created from upstream-master in subsequent tasks.

## Why
The fix/* branches are going to be force-pushed with completely new histories rebased on upstream-master. If any work currently only exists on local main (not pushed to fork/main), or only exists as untracked files, it would be at risk during the rebase operations. This pre-work step creates a safe baseline.

## Context
- Local branch-to-PR mapping that must be preserved:
  - fork/fix/back-466-core-done-checks → PR #635
  - fork/fix/back-467-active-filters → PR #636
  - fork/fix/back-468-blocked-styling → PR #637
  - fork/fix/back-471-cli-commit-behaviour-tests → PR #638
  - fork/fix/back-472-config-list-descriptor-map → PR #639
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All untracked backlog/tasks/back-46*.md through back-477*.md files committed to local main
- [ ] #2 git push fork main succeeds — fork/main is up to date with local main
- [ ] #3 git log main..fix/back-466-core-done-checks --oneline confirms no work exists only on fix branch that isn't in main
- [ ] #4 git log main..fix/back-467-active-filters --oneline checked
- [ ] #5 git log main..fix/back-468-blocked-styling --oneline checked
- [ ] #6 All five PR branch → fork branch mappings documented and verified reachable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Stage all untracked backlog/tasks/back-46x through back-482 task files AND all modified task files (back-200..back-438 range — these also need to be preserved before rebase ops)
2. Commit everything to local main with message: BACK-478 - Preserve sync current work before PR rebasing
3. Push local main to fork remote: `git push fork main`
4. Verify the five fix branches via `git log main..<branch> --oneline` — expect empty output (no branch-only commits)
5. Check all five fork branch mappings are reachable via `git ls-remote fork`

No TypeScript or source code touched — no tsc/bun checks required.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
