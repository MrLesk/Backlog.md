---
id: BACK-582
title: Add a decision list command
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/845'
priority: medium
type: enhancement
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #845. `backlog decision` exposes only `create` (src/cli.ts:4132-4155), so decisions can be written and searched but never enumerated. There is no way to answer "what decisions exist" from the CLI. `decision create --plain` also errors, even though the shipped agent guidance tells agents to always use --plain.

Maintainer direction to respect: bring docs and decisions operations toward task parity carefully and CLI-first. Do NOT add new MCP tools for this - MCP tools consume agent context windows - unless a tool is truly trivial.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog decision list` enumerates decisions
- [ ] #2 `backlog decision list --plain` produces AI-friendly text output
- [ ] #3 `backlog decision list --json` produces stable JSON output
- [ ] #4 Listed output shows at least id, title, and status for each decision
- [ ] #5 The new command is described in the CLI help schema
- [ ] #6 Tests cover the new command
- [ ] #7 Scope stays limited to list; a -d/--description option on `decision create` may ride along only if it is trivial
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
