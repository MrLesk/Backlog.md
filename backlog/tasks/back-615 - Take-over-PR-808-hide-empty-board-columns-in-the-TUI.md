---
id: BACK-615
title: 'Take over PR #808: hide empty board columns in the TUI'
status: To Do
assignee: []
created_date: '2026-08-09 13:49'
labels: []
dependencies: []
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Takeover approved by Alex (2026-08-07 takeover-mode ruling, reconfirmed 2026-08-09: "ok fine to take over. and go by our rules"). Take over the contributor branch from https://github.com/MrLesk/Backlog.md/pull/808, preserve the author credit via cherry-pick, bring it up to date with main, complete it to project standards, and prepare it for merge. Owner constraint from the original ruling: the change is fine as long as the TUI footer does not get overcrowded. Evaluate the PR approach first; if the current implementation conflicts with the rewritten board/TUI code that landed since (BACK-565, BACK-605, BACK-609), reimplement minimally while preserving authorship of the original commits where feasible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Empty columns are hidden on the TUI board per the intent of PR #808
- [ ] #2 The TUI footer does not become overcrowded
- [ ] #3 Original author credit is preserved in the commit history where feasible
- [ ] #4 Tests cover the empty-column behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
