---
id: BACK-545
title: Add stable JSON output to read commands
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-07-13 16:06'
labels:
  - cli
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/784'
type: enhancement
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a documented, curated public JSON surface for task list, task view, and heterogeneous search without exposing internal TypeScript objects. The CLI remains the canonical interface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An explicit --json option is available on task list, task view, and search
- [ ] #2 Successful JSON mode writes valid JSON only to stdout; errors use stderr and a nonzero exit code
- [ ] #3 Plan review defines the stable public fields, envelope, and heterogeneous result discrimination before implementation
- [ ] #4 Precedence with --plain, interactive behavior, and non-TTY behavior is documented and deterministic
- [ ] #5 Output represents documented public semantics only and does not expose internal TypeScript objects
- [ ] #6 Tests cover empty, single, multiple, heterogeneous, error, and shell-piping cases
- [ ] #7 CLI help and user documentation describe the JSON contract and examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
