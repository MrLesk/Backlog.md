---
id: BACK-443
title: Add PowerShell completion support
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 22:55'
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
- [ ] #1 `backlog completion install --shell pwsh` is supported and installs completions in the expected PowerShell profile-relative location.
- [ ] #2 Generated PowerShell completions are maintained in `completions/backlog.ps1` and behave consistently with existing shell completions.
- [ ] #3 Completion documentation and CLI instructions describe PowerShell installation and usage without regressing existing shell docs.
- [ ] #4 PowerShell completion behavior handles cursor and spacing cases covered by the helper tests.
- [ ] #5 Relevant focused tests, typecheck, formatting/linting, GitHub checks, and Codex review pass before merge.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
