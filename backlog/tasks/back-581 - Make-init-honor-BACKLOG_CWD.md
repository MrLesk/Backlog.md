---
id: BACK-581
title: Make init honor BACKLOG_CWD
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 18:54'
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
- [x] #1 With BACKLOG_CWD set, `backlog init` targets the pinned directory rather than the process directory
- [x] #2 Without BACKLOG_CWD set, init behavior is unchanged
- [x] #3 Test coverage mirrors the approach used in src/test/runtime-cwd.test.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace init's direct `const cwd = process.cwd()` (src/cli.ts) with the same runtime resolution every other command uses. Extract a shared `resolveRuntimeCwdOrExit()` helper out of `requireProjectRoot()` so init and all other commands report an invalid BACKLOG_CWD with the identical message and exit code instead of falling into init's generic 'Failed to initialize project' catch.
2. Audit the whole init path for other process.cwd() reads so the entire flow targets the resolved directory: git detection/init (isGitRepository/initializeGitRepository), `new Core(cwd)` and FileSystem/backlog-directory resolution, initializeProject in src/core/init.ts (agent instruction files, MCP guideline nudges, Claude agent install), the advanced config wizard, shell completion install, and MCP client setup commands. Confirm each already derives from the passed directory or is intentionally user/home-scoped; fix anything that is not.
3. Add coverage in src/test/cli-init-create.test.ts mirroring src/test/runtime-cwd.test.ts env handling: run `backlog init` from an unrelated directory with BACKLOG_CWD pinned to the project directory and assert the pinned directory receives backlog/config.yml (and the agent instruction file) while the process directory stays untouched; assert an invalid BACKLOG_CWD exits 1 with the shared 'Invalid directory from BACKLOG_CWD' message. Existing init tests without the env var stay as the unchanged-behavior baseline.
4. Verify with bunx tsc --noEmit, bun run check ., the init-related suites (cli-init-*, runtime-cwd, enhanced-init, server-init), then a full bun test.

5. Implemented as above; the shared helper shipped as `requireRuntimeCwd()` (not `resolveRuntimeCwdOrExit()`) to match the existing `requireProjectRoot()` naming in src/cli.ts. Step 2's audit found no other process.cwd() reads on the init path, so no further code changes were needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Init now resolves its target directory through the same runtime resolution as every other command.

Change (src/cli.ts):
- Extracted `requireRuntimeCwd()` from `requireProjectRoot()`. It wraps `resolveRuntimeCwd()` and, on an invalid override, prints the resolver's message and exits 1. `requireProjectRoot()` now calls it, so there is one implementation of 'resolve the runtime cwd or fail'.
- init's `const cwd = process.cwd()` (and the comment claiming the bypass was deliberate) is replaced by `await requireRuntimeCwd()`. Everything downstream in init already flowed from that single `cwd` variable, so the whole flow moves with it: git detection (`isGitRepository`), `git init` (`initializeGitRepository`), `new Core(cwd)`, the re-init config probe, `ensureMcpGuidelines(cwd, ...)`, and `initializeProject`.

Audit of the rest of the init path for other process.cwd() reads (none found; no further changes needed):
- src/core/init.ts derives everything from `core.filesystem.rootDir`, so agent instruction files, MCP guideline nudges and the Claude agent install all land in the resolved directory.
- src/agent-instructions.ts joins every write onto the passed projectRoot.
- FileSystem/resolveBacklogDirectory are strictly projectRoot-scoped and never walk up or fall back to process.cwd().
- src/git/operations.ts passes projectRoot as the subprocess cwd for both helpers.
- The advanced config wizard has no filesystem/cwd dependency; shell completion install is homedir-scoped.
- MCP client setup subprocesses were left alone on purpose: every registration command is user/global scoped (`claude mcp add -s user`, `codex mcp add`, `gemini mcp add -s user`, `kiro-cli mcp add --scope global`), so the child process cwd does not select a project.

No new `--cwd` flag on init: only `mcp start` accepts one, and the plain `resolveRuntimeCwd()` call keeps init consistent with the rest of the CLI surface.

Tests (src/test/cli-init-create.test.ts, new BACKLOG_CWD describe, mirroring src/test/runtime-cwd.test.ts env handling): two sibling git repos, init run from one with BACKLOG_CWD pinned to the other. Asserts config.yml and AGENTS.md land in the pinned directory and the process directory stays empty; a paired case without the env var asserts the process directory is still initialized; a third case asserts an override pointing at a missing directory exits 1 with 'Invalid directory from BACKLOG_CWD' and initializes nothing.

Regression check: with src/cli.ts stashed, the pinned-directory and invalid-override tests fail (the pinned case initializes the process directory, the invalid case exits 0) while the no-override case still passes.

Post-review finalization: fresh review approved with zero blocking findings. `git fetch origin` showed origin/main still at 3b3bddc9 (the branch base), so the rebase was a no-op and no conflicts arose. Re-verified after the fetch: bunx tsc --noEmit clean, and the init/runtime-cwd suites (cli-init-create, cli-init-claude-default, cli-init-cursor-pty, cli-init-no-git, runtime-cwd, enhanced-init, server-init) pass — 66 pass, 1 skip, 0 fail.

Review fixes from PR #859 (Codex), both accepted:

P1 - test isolation from an inherited BACKLOG_CWD (src/test/cli-init-create.test.ts): the suite's CLI subprocesses inherit the test process environment, so a BACKLOG_CWD exported in a developer's shell would have pointed the unpinned init runs at a real board. Fixed at the suite level with beforeAll/afterAll that remove the variable and restore it, mirroring the save/restore in runtime-cwd.test.ts. One guard covers every subprocess in the file, including the pre-existing init and task/draft create tests, rather than adding .env() to ~20 spawn sites; the pinned test still sets the variable explicitly.

P2 - init help description (src/cli.ts): now reads 'initialize backlog project in the current directory (or BACKLOG_CWD when set)'. One line, no added help prose; this string had no other copies in the tree.

Verification: cli-init-create passes with no override (29 pass) and again with BACKLOG_CWD exported to a decoy git repo (29 pass, decoy left containing only .git and a clean git status). Demonstrated the guard is load-bearing: with it stashed and the same decoy exported, 12 tests fail and the decoy is written with backlog/config.yml, AGENTS.md and CLAUDE.md. Also green: the init/runtime-cwd/guidance suites together (81 pass across 7 files), bunx tsc --noEmit, and bun run check . (357 files).

Rebased onto origin/main (d8f394f5, BACK-576) after pushing the review fixes; main had touched both src/cli.ts and src/test/cli-init-create.test.ts. Rebase was conflict-free and the suite-level BACKLOG_CWD guard automatically covers the two init tests BACK-576 added to that file. Re-verified post-rebase: cli-init-create 31 pass with no override and 31 pass with BACKLOG_CWD exported to a decoy git repo (decoy left with only .git and a clean status); init/runtime-cwd/guidance suites 83 pass 1 skip 0 fail across 8 files; bunx tsc --noEmit and bun run check . clean; full bun run test 1905 pass, 5 skip, 0 fail across 213 files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog init` now resolves its target directory with the shared `resolveRuntimeCwd` flow instead of reading process.cwd() directly, so BACKLOG_CWD (and any future --cwd) pins init to the same directory every other command targets. A new `requireRuntimeCwd()` helper in src/cli.ts, factored out of `requireProjectRoot()`, gives both paths one implementation and one error message on an invalid override. The rest of the init path already flowed from that single cwd value, so git detection/init, Core, the re-init config probe, agent instruction files, MCP guideline nudges and the Claude agent install all follow it; an audit found no other process.cwd() reads on the init path. Verified with new BACKLOG_CWD integration tests in src/test/cli-init-create.test.ts (pinned directory initialized, process directory untouched; unchanged behavior without the override; invalid override exits 1 and initializes nothing), confirmed to fail without the fix, plus bunx tsc --noEmit, bun run check ., and the full bun test suite (1900 pass, 5 skip, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
