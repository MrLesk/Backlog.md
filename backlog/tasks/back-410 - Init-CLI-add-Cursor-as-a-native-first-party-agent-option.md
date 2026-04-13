---
id: BACK-410
title: 'Init CLI: add Cursor as a native first-party agent option'
status: To Do
assignee: []
created_date: '2026-03-25 18:13'
labels:
  - cli
  - init
  - agents
  - cursor
dependencies: []
references:
  - >-
    https://cursor.com/docs (verify current rules/skills paths when
    implementing)
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today, `backlog init` treats Cursor mainly via the `cursor` CLI alias mapping to `AGENTS.md` (see completed BACK-263). Cursor users should get an explicit, first-class choice during initialization—parallel to how other tools are presented—so Backlog workflow guidance is installed through Cursor’s native instruction surfaces (for example project rules under `.cursor/` or the supported skill/rule layout Cursor documents), not only by reusing the generic `AGENTS.md` path unless the user picks that separately.

Scope the implementation to the init flow: interactive wizard, non-interactive flags, help text, and any shared agent-selection plumbing. Align behavior with existing idempotent guideline injection and auto-commit patterns used for other agent files. Web init should stay consistent with CLI where the product already mirrors agent selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog init` exposes Cursor as its own selectable first-party agent (wizard and documented non-interactive flags), not only as an alias that silently maps to `AGENTS.md`.
- [ ] #2 Choosing Cursor installs Backlog workflow content into Cursor’s supported native location(s) with the same idempotent marker behavior as other agent targets.
- [ ] #3 CLI help, completion (if applicable), and tests cover the new option and invalid combinations produce clear errors.
- [ ] #4 If web initialization offers agent file selection, Cursor appears there consistently with CLI unless intentionally out of scope (then note the gap in the task notes).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
