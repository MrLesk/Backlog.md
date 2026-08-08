---
id: BACK-605
title: Route all TUI operations through shared core with runtime cwd
status: To Do
assignee: []
created_date: '2026-08-08 15:56'
labels: []
dependencies: []
ordinal: 244000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TUI board handlers construct Core(process.cwd()) directly at multiple sites in src/ui/board.ts (file:line evidence in the BACK-581 review notes), bypassing resolveRuntimeCwd and BACKLOG_CWD. This is the same divergence family as issue #854 (init ignoring BACKLOG_CWD). Direction from Alex (2026-08-08): all interfaces must go through the same core logic; no interface builds its own Core from process.cwd(). Audit the TUI (and any other interface) for remaining direct Core(process.cwd()) construction and route everything through the shared instance or the shared runtime cwd resolver.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No TUI code constructs Core from process.cwd() directly; all handlers reuse the shared core instance or the shared runtime cwd resolver
- [ ] #2 TUI operations honor BACKLOG_CWD end to end
- [ ] #3 A repo-wide audit confirms no other interface constructs Core from process.cwd() outside the shared resolver, or aligns the stragglers
- [ ] #4 Tests or recorded verification evidence cover the BACKLOG_CWD path in the TUI
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
