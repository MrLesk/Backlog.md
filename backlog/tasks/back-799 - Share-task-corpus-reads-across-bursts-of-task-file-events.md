---
id: BACK-799
title: Share task corpus reads across bursts of task file events
status: To Do
assignee: []
created_date: '2026-11-04T17:47:00Z'
labels: []
dependencies: []
ordinal: 405000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The board's task watcher resolves each task file event with FileSystem.loadTask, which reads the whole active and archived corpus. A checkout or rebase that rewrites N task files starts about 2N full corpus reads at once, so board memory grows with N x corpus size (Refs #1038).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A burst of task file events shares task corpus listings instead of starting one full read per event
- [ ] #2 A request made during a read joins the next read and never sees a listing that started before it
- [ ] #3 Queued ContentStore reloads from archived-directory and non-task events fold into one reload
- [ ] #4 loadTask keeps its identity, ambiguity and archived-only rules
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
