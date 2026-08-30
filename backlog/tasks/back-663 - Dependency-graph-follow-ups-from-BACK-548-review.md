---
id: BACK-663
title: Dependency graph follow-ups from BACK-548 review
status: To Do
assignee: []
created_date: '2026-08-30 19:38'
labels:
  - cli
  - tui
  - web
  - enhancement
dependencies: []
ordinal: 295000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Low-severity findings deferred from the PR #960 review triage, none affecting supported flows today: (1) formatter indentation builds a growing prefix per depth (dependency-graph-text.ts appendTreeLines) — cap or iterate for pathological depths; (2) BFS uses queue.shift() — cursor micro-optimization; (3) the filtered TUI viewer collapses duplicate canonical IDs where the CLI fails closed (task-viewer-with-search.ts resolveDependencyCorpus) — align on fail-closed; (4) cross-branch completed dependencies render missing in the web graph (store getTasks excludes completed records; only local completed joins the corpus); (5) the filtered TUI readiness snapshot goes stale on out-of-view external changes until reopen; (6) after graph-link navigation the web sync ref compares dependency lists across different task IDs and triggers one redundant fetch (App.tsx sync effect — require matching IDs); (7) another client editing a different task leaves an open modal dependents list stale until reopen. Self-dependency creation is BACK-656, drafts-in-corpus policy is BACK-601, MCP corpus alignment is BACK-625.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each listed item is fixed or explicitly closed as accepted behavior with a note
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
