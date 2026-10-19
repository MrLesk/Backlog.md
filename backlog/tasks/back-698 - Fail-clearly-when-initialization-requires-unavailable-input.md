---
id: BACK-698
title: Fail clearly when initialization requires unavailable input
status: Done
assignee:
  - '@codex-init-input'
created_date: '2026-09-27 22:42'
updated_date: '2026-09-27 22:52'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1012'
modified_files:
  - src/cli.ts
  - src/test/cli-init-input.test.ts
priority: high
type: bug
ordinal: 328000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an agent or script runs backlog init with closed or non-interactive input and required information is missing, initialization must fail with a useful diagnostic instead of reporting success without creating the project. Preserve successful fully specified initialization and the existing interactive choices.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With closed stdin, initialization without a project name exits nonzero, explains the missing input, and does not create a partial project.
- [x] #2 With a supplied project name but no Git repository or explicit Git choice, initialization with closed stdin exits nonzero and explains how to proceed.
- [x] #3 Fully specified initialization and actual interactive initialization keep their existing behavior; no default Git policy is introduced.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce missing project-name and missing Git-choice initialization with real closed stdin, recording exit codes and filesystem state; keep fully specified commands as success controls.
2. At the existing CLI init prompt boundaries, use hasInteractiveTTY and abortInitialization to fail with actionable errors before a required Git choice, project name, or setup wizard would read unavailable input. Preserve interactive choices, flag-driven defaults, and explicit --no-git behavior.
3. Add CLI subprocess regression tests with stdin closed for missing-name, missing-Git-choice, and remaining-wizard cases, asserting nonzero status, diagnostic, and no partial project. Cover fully specified Git and filesystem-only controls, and verify actual terminal prompts with a PTY. Correct project-name help to describe its existing prompt behavior.
4. Run focused init tests, type checking, and Biome checks; inspect the diff and simplify. Record evidence and modified paths in this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before fix on Bun 1.3.14: real /dev/null stdin produced exit 0 with no backlog for missing name (Git and --no-git), missing Git choice, and the remaining wizard. The new subprocess regression suite showed 5 failures (all false success) and 2 successful fully specified controls.

Implemented and frozen for architecture review. src/cli.ts adds three local terminal checks before required Git/name/setup prompts, using existing hasInteractiveTTY and abortInitialization. No Git default, flag policy, core init behavior, or generic prompt layer changed. Project-name help now says prompted when omitted.
Verification on Bun 1.3.14 (/tmp/back694-ci-runtime/bun): real /dev/null stdin cases changed from exit 0/no config to exit 1/actionable diagnostic/no new files for missing name with Git, missing name with --no-git, missing Git choice, and flag-free setup wizard. Fully specified Git and --no-git controls remain exit 0 with config created. Evidence: /tmp/back698-before.json and /tmp/back698-after.json.
Real PTY controls passed: missing-name + Git-choice prompts with each explicit selection (Git created only when chosen), plus the complete flag-free interactive wizard choosing filesystem-only. Each exited 0 and created the config. Logs: /tmp/back698-pty-git.log, /tmp/back698-pty-filesystem.log, /tmp/back698-pty-full.log. PTY dimensions set to 140x40 to model a usable terminal.
The new tests use OS temporary directories outside the checkout so missing-Git cases cannot inherit the parent repository. Focused init group: 83 tests pass across cli-init-input, cli-init-create, cli-init-no-git, cli-init-claude-default, enhanced-init. Type check, full Biome check (435 files), help inspection, and git diff --check pass.
Simplicity review: kept existing init abort/TTY checks and three bounded guards; no added production helper, exported API, or policy. Only source files changed for this task: src/cli.ts and src/test/cli-init-input.test.ts. Unrelated task records and BACK-696 changes were preserved. No unresolved product choices.

Architecture review completed with no blockers or changes requested. All acceptance criteria and Definition of Done items are supported by the recorded closed-stdin, fully specified, actual PTY, type, lint, and focused-test evidence. Exact focused command on Bun 1.3.14: bun test --timeout=10000 src/test/cli-init-input.test.ts src/test/cli-init-create.test.ts src/test/cli-init-no-git.test.ts src/test/cli-init-claude-default.test.ts src/test/enhanced-init.test.ts — 83 passed, 0 failed, 312 assertions. No source changes after validation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Initialization now exits with code 1 and actionable guidance when a required Git choice, project name, or setup prompt has no interactive terminal. Closed-stdin failures leave the directory unchanged. Fully specified initialization and real terminal prompts retain the existing Git choices and defaults. Project-name help now correctly says it is prompted when omitted.
Verified the false-success cases before and after with /dev/null, both fully specified controls, both interactive Git choices, and the complete interactive wizard. All 83 focused tests, TypeScript checks, and full Biome checks pass on Bun 1.3.14. Architecture review found no blockers; no new prompt layer or Git policy was added.
<!-- SECTION:FINAL_SUMMARY:END -->
