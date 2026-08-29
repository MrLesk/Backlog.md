---
id: BACK-646
title: Count emoji as double-width in the TUI
status: To Do
assignee: []
created_date: '2026-08-29 18:27'
labels:
  - tui
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/950'
  - 'https://github.com/MrLesk/Backlog.md/issues/949'
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Emoji in the TUI measured one cell wide, drifting kanban column borders and any row containing emoji (issue #949). The real fix shipped in neo-neo-bblessed 1.0.10 (generated Unicode 16 Emoji_Presentation table feeding both charWidth and the layout regexes, plus VS16 sequence handling), so Backlog.md only needs the dependency bump plus the TUI regression test contributed by bjohas in PR #950, which cannot be maintainer-edited because the fork is org-owned.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 neo-neo-bblessed is 1.0.10 in package.json, bun.lock, and bun.nix with the local patch removed
- [ ] #2 The TUI emoji-width regression test from PR #950 passes against the published dependency
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
