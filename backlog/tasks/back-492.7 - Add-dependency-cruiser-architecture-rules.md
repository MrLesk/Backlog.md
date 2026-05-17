---
id: BACK-492.7
title: Add dependency-cruiser architecture rules
status: To Do
assignee: []
created_date: '2026-05-17 21:12'
labels:
  - tooling
  - architecture
milestone: m-13
dependencies: []
modified_files:
  - .dependency-cruiser.cjs
  - .github/workflows/ci.yml
  - package.json
parent_task_id: BACK-492
priority: low
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
No import boundary rules exist today. As the codebase grows, accidental coupling between layers (e.g. TUI importing from web, core importing from server) will go undetected. `dependency-cruiser` codifies the intended layered architecture and catches violations in CI before they accumulate.

Intended layer hierarchy (nothing may import from layers above it):
- `src/utils/` — pure utilities, no layer deps
- `src/core/` — business logic, may use utils only
- `src/mcp/`, `src/server/`, `src/ui/` — entry-point layers, may use core + utils
- `src/web/` — frontend only; must not import from `src/server/`

**Implementation plan:**
1. `bun add -d dependency-cruiser`
2. Create `.dependency-cruiser.cjs` with rules encoding the hierarchy above
3. Run first pass; document any known violations as exceptions with explanatory comments
4. Add CI step: `bunx depcruise src --config .dependency-cruiser.cjs`
5. Optional: generate architecture diagram (`--output-type dot`) and commit to `docs/`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 .dependency-cruiser.cjs present with layered import rules
- [ ] #2 CI step added and passes on main branch
- [ ] #3 Known current violations documented as exceptions in the config
- [ ] #4 Any new cross-layer import in a subsequent PR causes CI to fail
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
