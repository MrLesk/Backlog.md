---
id: BACK-391
title: Add first-class PowerShell support for shell completion installer
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-19 01:52'
updated_date: '2026-02-19 22:57'
labels:
  - cli
  - completion
  - powershell
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend CLI shell completion support so `backlog completion install --shell pwsh` is fully supported on Windows and Unix-like environments, including dynamic resolution of `$PROFILE.CurrentUserAllHosts`, PowerShell completion script generation, and documentation updates in completions docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog completion install --shell pwsh` is accepted and installs a completion script
- [x] #2 Installer resolves PowerShell profile path dynamically rather than hardcoding OS-specific profile paths
- [x] #3 PowerShell completion script snapshot exists under `completions/` similar to other shells
- [x] #4 Shell option completions include `pwsh` as user-facing shell option
- [x] #5 Completion docs describe PowerShell installation and profile loading flow
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation completed in working tree; verification commands requiring Bun are blocked in this environment because `bun`/`bunx` are not available on PATH. Pending validation on a Bun-enabled environment before marking Done.

Follow-up fix: enhanced PowerShell profile resolver to probe common Windows executable paths (`System32\WindowsPowerShell\v1.0\powershell.exe`, `Program Files\PowerShell\7\pwsh.exe`, x86 variant) in addition to PATH lookups for `powershell`/`pwsh`. This addresses environments where PATH does not include PowerShell executables.

Adjusted implementation per review to target PowerShell 7 only: profile resolution now probes `pwsh` (plus common `pwsh.exe` install paths) and no longer falls back to legacy `powershell.exe` / WindowsPowerShell profile paths. Auto-detection now keys off `pwsh` and PowerShell 7 markers in `PSModulePath`.

PowerShell completion wrapper simplified to avoid backend behavior changes: uses raw cursor endpoint (`$cursorPosition`) and pads command text to preserve trailing-space context (`$commandAst.ToString().PadRight($cursorPosition)` when needed). Removed fallback merge and append/rewrite heuristics from the PowerShell script; this restores bash-like progression (`backlog task` -> task/tasks, `backlog task ` -> subcommands) and resolves prior replacement-path complexity.

Fixed syntax regression in embedded PowerShell completion template in `src/commands/completion.ts` (missing closing parentheses introduced during previous edits).

Validated behavior with `CommandCompletion.CompleteInput` against local CLI wrapper in pwsh and with direct `__complete` calls.

Adjusted PowerShell completion `CompletionResult` emission to append a trailing space in `CompletionText` while preserving `ListItemText`/tooltip as the raw token. This ensures accept-and-continue behavior (`task` -> `task `, `create` -> `create `) without changing backend `__complete` semantics. Applied in both `completions/backlog.ps1` and embedded script in `src/commands/completion.ts`.

Renamed user-facing shell option from `powershell` to `pwsh` across completion install UX and value completions. `installCompletion` now normalizes legacy `--shell powershell` input to `pwsh` internally for compatibility, while help text/completion suggestions only expose `pwsh`. Updated docs/examples (`CLI-INSTRUCTIONS.md`, `completions/README.md`, `completions/backlog.ps1`) accordingly.

Validation: `bun test src/completions/helper.test.ts` passed, `bunx tsc --noEmit` passed, `bun src/cli.ts completion __complete "backlog completion install --shell " <len>` returns `bash zsh fish pwsh`, and `bun src/cli.ts completion install --shell pwsh` succeeded in escalated run (installed script path under `$PROFILE.CurrentUserAllHosts` directory).

Removed legacy alias support for `--shell powershell` from `installCompletion`; CLI now rejects `powershell` and accepts only `pwsh` as the shell option. Verified behavior: `bun src/cli.ts completion install --shell powershell` now errors as unsupported, while `--shell pwsh` installs successfully.

Task updated to reflect current state: all acceptance criteria are now implemented and validated, including `--shell pwsh` as the only supported PowerShell shell option and rejection of `--shell powershell`.

Correction to earlier note: legacy alias normalization (`powershell` -> `pwsh`) was removed; `powershell` is now intentionally unsupported.

Definition of Done #2 (`bun run check .`) remains unchecked due existing repository-wide Biome formatting issues unrelated to this task’s scoped changes.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
