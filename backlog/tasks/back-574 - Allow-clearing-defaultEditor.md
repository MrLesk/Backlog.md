---
id: BACK-574
title: Allow clearing defaultEditor
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/844'
priority: medium
type: bug
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #844. There is no supported way to clear a configured defaultEditor. `config set defaultEditor ""` is rejected because the value is validated as an executable before it is stored (src/cli.ts:4452-4462), and `init --default-editor ""` is silently discarded by truthiness fallbacks (src/cli.ts:827 and src/cli.ts:1032). The only workaround today is hand-editing config.yml.

This matters because the shipped default `code --wait` blocks until the editor window closes, which can hang unattended agent processes. Users need a supported way to turn the editor off.

Reference fix: a fork by iRonin has a clean, tested fix in commit 4541e71 on branch fix/allow-empty-default-editor of iRonin/Backlog.md (from withdrawn PR #850), and it cherry-picks cleanly onto main. If that commit is used, preserve the original commit authorship.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Setting an empty value via `config set defaultEditor ""` clears the key from config.yml
- [ ] #2 `init --default-editor ""` clears a previously configured editor
- [ ] #3 Non-empty defaultEditor values are still validated before being stored
- [ ] #4 Tests cover both clear paths (config set and init)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
