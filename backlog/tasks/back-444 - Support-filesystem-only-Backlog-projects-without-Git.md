---
id: BACK-444
title: Support filesystem-only Backlog projects without Git
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 23:48'
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
- [ ] #1 Init can run in a non-Git directory with an explicit filesystem-only/no-git option.
- [ ] #2 Interactive init in a non-Git directory lets the user continue without creating a Git repository.
- [ ] #3 Filesystem-only projects persist configuration that disables cross-branch checks, remote operations, and auto-commit.
- [ ] #4 Core task, draft, document, decision, milestone, CLI, MCP, and Web flows keep working for local files when no Git repository exists.
- [ ] #5 Git-only behavior is skipped gracefully when Git is unavailable or disabled, without noisy stack traces for normal local workflows.
- [ ] #6 Documentation explains Git-backed and filesystem-only initialization paths.
- [ ] #7 Regression tests cover init and representative local commands in a non-Git project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
