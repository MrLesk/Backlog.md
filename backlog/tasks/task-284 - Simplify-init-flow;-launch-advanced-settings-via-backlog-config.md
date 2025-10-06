---
id: task-284
title: Simplify init flow; launch advanced settings via backlog config
status: Done
assignee:
  - '@codex'
created_date: '2025-10-05 11:17'
updated_date: '2025-10-06 19:41'
labels:
  - cli
  - init
  - config
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: Make backlog init minimal and move advanced settings to run under backlog config when opted in.

Summary
- Keep agent instruction selection in init.
- After that, ask a single confirm: "Configure advanced settings now? (y/N)".
- If Yes: immediately run `backlog config` (interactive wizard) and then finish init.
- If No (default): finish init with safe defaults; no other prompts.
- Preserve all existing flags and non-interactive behavior for backward compatibility.

Context
Init currently prompts for many settings (branch checks, remote, zero-padding, editor, web UI, etc.). We want a faster first-run and make advanced choices accessible via a dedicated interactive flow at `backlog config` (no subcommand).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Init prompts only: project name ➜ agent instruction selection ➜ advanced confirm (default No).
- [x] #2 If user selects Yes, launch `backlog config` interactive wizard immediately and return to complete init.
- [x] #3 Implement default action for `backlog config` (no args) to run an advanced interactive wizard; keep `config list|get|set` working unchanged.
- [x] #4 Remove other prompts from init (zero-padding, editor, cross-branch, web UI, git hooks) unless advanced=Yes path is taken (then handled in wizard).
- [x] #5 Honor all existing init flags and `--defaults` to remain non-interactive and not auto-launch the wizard.
- [x] #6 Re-init: prefill project name with existing; rerun agent selection; advanced confirm behaves the same; wizard preloads current config values.
- [x] #7 Post-init summary shows project name and which agent instruction files were created/skipped; no advanced details unless wizard ran.
- [x] #8 backlog config wizard includes: cross-branch (checkActiveBranches, remoteOperations, activeBranchDays), git behavior (bypassGitHooks, autoCommit), ID formatting (zeroPaddedIds width/disabled), editor (defaultEditor with availability check), web UI (defaultPort, autoOpenBrowser).
- [x] #9 Defaults when wizard is skipped: checkActiveBranches=true, remoteOperations=true, activeBranchDays=30, bypassGitHooks=false, zeroPaddedIds disabled, defaultEditor unset, defaultPort=6420, autoOpenBrowser=true.
- [x] #10 Docs: Update README init section and mention `backlog config` for advanced options; update any references in AGENTS.md if needed.
- [x] #11 Tests: add/adjust tests for new init flow ordering, advanced confirm default=No, and `backlog config` default action; keep existing tests passing (agent files, flags, non-interactive).
- [x] #12 Backwards compatibility: existing scripts/CI using init flags or `--defaults` continue to work without wizard launch or extra prompts.
- [x] #13 Code style/quality: Biome passes; type-check passes; no regressions in TUI flows; final summary output remains concise.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the existing advanced init prompts into a reusable helper and wire it as the default `backlog config` wizard.
2. Rework `backlog init` interactive flow to only ask for project name, agent instructions, and the advanced-settings confirm that launches the wizard when accepted.
3. Update docs and automated tests to match the new flow, ensuring defaults and flag-based behaviors remain unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Refactored init advanced prompts into a reusable wizard, reused by `backlog config` and exposed via a new helper.
- Simplified `backlog init` interactive flow to project name → agent instructions → advanced confirmation, applying safe defaults when skipped.
- Updated docs plus added unit coverage for wizard/config flows and CLI summary output.
- Tests: `bunx tsc --noEmit`, `bun run check .`, `bun test`.

Reopening after Codex review on PR 385 flagged missing `backlog config list` subcommand. Investigating CLI regression to restore list handler while preserving other config commands.

- Restored `backlog config list` CLI coverage and added regression test ensuring list/get/set remain available.
- Tests: bun test src/test/config-commands.test.ts
<!-- SECTION:NOTES:END -->
