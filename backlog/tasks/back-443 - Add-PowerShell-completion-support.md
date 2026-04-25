---
id: BACK-443
title: Add PowerShell completion support
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 22:55'
updated_date: '2026-04-25 23:24'
labels:
  - cli
  - completions
  - powershell
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/554'
  - BACK-391
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add first-class PowerShell (`pwsh`) shell completion support for the CLI. This tracks PR #554 and replaces the stale `BACK-391` reference, which conflicts with an existing task on current `main`. The feature should align PowerShell behavior with the existing shell completion workflow and keep generated completion artifacts and documentation current.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog completion install --shell pwsh` is supported and installs completions in the expected PowerShell profile-relative location.
- [x] #2 Generated PowerShell completions are maintained in `completions/backlog.ps1` and behave consistently with existing shell completions.
- [x] #3 Completion documentation and CLI instructions describe PowerShell installation and usage without regressing existing shell docs.
- [x] #4 PowerShell completion behavior handles cursor and spacing cases covered by the helper tests.
- [x] #5 Relevant focused tests, typecheck, formatting/linting, GitHub checks, and Codex review pass before merge.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create a current Backlog task for PR #554 because the original BACK-391 ID conflicted with an existing task on main.
2. Rebase the contributor branch onto current main and remove the stale BACK-391 task file from the PR diff.
3. Review the PowerShell completion implementation, docs, and tests for readiness issues.
4. Add installer-level coverage for explicit `--shell pwsh`, inherited `PSModulePath` behavior, and legacy `powershell` rejection.
5. Run local validation, approve fork CI runs, wait for GitHub checks and Codex review, then merge the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR #554 was updated from the stale `BACK-391` reference to `BACK-443`, rebased onto current main, and cleaned so the PR no longer adds a conflicting task file. Review found installer coverage gaps and PowerShell detection edge cases. The final branch keeps reliable explicit `--shell pwsh` support, avoids inferring PowerShell solely from inherited `PSModulePath`, and adds tests around the PowerShell install path and detection behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #554 as `BACK-443 - Add PowerShell completion support`.

The merged change adds first-class `pwsh` completion support, a `completions/backlog.ps1` reference script, PowerShell install/usage docs, `pwsh` shell-value completions, and installer tests for profile-relative installation and shell detection edge cases. The stale `BACK-391` task file was removed from the PR branch and the PR title/body now point to BACK-443.

Validation passed locally with `bun test src/completions/helper.test.ts src/commands/completion.test.ts`, `bunx tsc --noEmit`, `bun run check .`, `bun run build`, CLI completion smoke checks, and `git diff --check`. The fork GitHub checks were approved and passed, and Codex left a thumbs-up on the final commit before merge.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
