---
id: BACK-581
title: Make init honor BACKLOG_CWD
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 18:12'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/854'
priority: high
type: bug
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #854. `backlog init` reads `process.cwd()` directly (src/cli.ts:740-742) instead of going through resolveRuntimeCwd (src/utils/runtime-cwd.ts), which every other command honors. With BACKLOG_CWD pinned to one project and a different project in the process directory, init silently re-initializes the wrong live board and exits 0. This was reported as a real incident in which another board config was rewritten.

Maintainer decision (confirmed): init follows the same resolveRuntimeCwd flow as every other command. init is idempotent, so no additional guard or confirmation prompt is expected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With BACKLOG_CWD set, `backlog init` targets the pinned directory rather than the process directory
- [ ] #2 Without BACKLOG_CWD set, init behavior is unchanged
- [ ] #3 Test coverage mirrors the approach used in src/test/runtime-cwd.test.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace init's direct `const cwd = process.cwd()` (src/cli.ts) with the same runtime resolution every other command uses. Extract a shared `resolveRuntimeCwdOrExit()` helper out of `requireProjectRoot()` so init and all other commands report an invalid BACKLOG_CWD with the identical message and exit code instead of falling into init's generic 'Failed to initialize project' catch.
2. Audit the whole init path for other process.cwd() reads so the entire flow targets the resolved directory: git detection/init (isGitRepository/initializeGitRepository), `new Core(cwd)` and FileSystem/backlog-directory resolution, initializeProject in src/core/init.ts (agent instruction files, MCP guideline nudges, Claude agent install), the advanced config wizard, shell completion install, and MCP client setup commands. Confirm each already derives from the passed directory or is intentionally user/home-scoped; fix anything that is not.
3. Add coverage in src/test/cli-init-create.test.ts mirroring src/test/runtime-cwd.test.ts env handling: run `backlog init` from an unrelated directory with BACKLOG_CWD pinned to the project directory and assert the pinned directory receives backlog/config.yml (and the agent instruction file) while the process directory stays untouched; assert an invalid BACKLOG_CWD exits 1 with the shared 'Invalid directory from BACKLOG_CWD' message. Existing init tests without the env var stay as the unchanged-behavior baseline.
4. Verify with bunx tsc --noEmit, bun run check ., the init-related suites (cli-init-*, runtime-cwd, enhanced-init, server-init), then a full bun test.
<!-- SECTION:PLAN:END -->
