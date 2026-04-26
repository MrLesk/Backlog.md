---
id: BACK-444
title: Support filesystem-only Backlog projects without Git
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 23:48'
updated_date: '2026-04-26 00:01'
labels:
  - cli
  - init
  - git
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/354'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let Backlog.md be initialized and used in a directory that is not a Git repository. This should support non-code and local-only workflows where Git is unnecessary, while keeping existing Git-backed workflows unchanged.

This supersedes the outdated TASK-266 PR branch idea. Rebuild the feature from current main instead of carrying the old broad diff.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Init can run in a non-Git directory with an explicit filesystem-only/no-git option.
- [x] #2 Interactive init in a non-Git directory lets the user continue without creating a Git repository.
- [x] #3 Filesystem-only projects persist configuration that disables cross-branch checks, remote operations, and auto-commit.
- [x] #4 Core task, draft, document, decision, milestone, CLI, MCP, and Web flows keep working for local files when no Git repository exists.
- [x] #5 Git-only behavior is skipped gracefully when Git is unavailable or disabled, without noisy stack traces for normal local workflows.
- [x] #6 Documentation explains Git-backed and filesystem-only initialization paths.
- [x] #7 Regression tests cover init and representative local commands in a non-Git project.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an explicit filesystem-only init path (`backlog init --no-git`) and interactive no-git choice when init runs outside a Git repository.
2. Persist no-git projects with `checkActiveBranches=false`, `remoteOperations=false`, and `autoCommit=false` from the shared initializer so CLI/Web/MCP-created projects use the same config semantics.
3. Harden Git operation boundaries so task, draft, document, decision, milestone, cleanup, CLI, Web, and MCP local-file flows skip Git work gracefully when no repository is present.
4. Add focused regression tests for no-git init and representative local commands in a non-Git project.
5. Update documentation, mark acceptance criteria/DoD, and retitle/update PR #354 once the branch is ready.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started from current main instead of carrying the old PR #354 diff. The old branch intent is preserved, but the implementation will be rebuilt around the current shared initializer and Git operation abstraction.

Implemented filesystem-only mode with a persisted filesystem_only config flag so Git helpers skip parent repositories too. Codex follow-ups fixed lazy Core paths so fresh GitOperations instances load config before repository/path-context checks, and made the server init endpoint parse optional boolean init flags without truthy string coercion. Validation passed: bun test src/test/cli-init-no-git.test.ts; targeted no-git/git/offline/core/server suites; bunx tsc --noEmit; bun run check .; full bun test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented filesystem-only Backlog projects from current main.

Summary:
- Added `backlog init --no-git` and an interactive no-Git choice when init runs outside a Git repository.
- Persisted filesystem-only mode with `filesystem_only: true` plus Git-disabled config defaults (`check_active_branches=false`, `remote_operations=false`, `auto_commit=false`).
- Hardened Git operations so filesystem-only projects skip Git work even when located under a parent Git repository, while preserving existing Git-backed behavior.
- Added lazy config loading for Git operation boundaries so fresh Core instances respect filesystem-only mode before explicit config loading.
- Tightened Web/API init boolean parsing so string `"false"` does not accidentally enable filesystem-only mode.
- Added no-Git regression coverage for init plus task, draft, document, decision, milestone, and local loading flows.
- Documented Git-backed and filesystem-only init paths in README.

Validation:
- `bunx tsc --noEmit`
- `bun run check .`
- `bun test`
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
