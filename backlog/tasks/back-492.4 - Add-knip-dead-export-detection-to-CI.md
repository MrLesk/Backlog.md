---
id: BACK-492.4
title: Add knip dead-export detection to CI
status: To Do
assignee: []
created_date: '2026-05-17 21:12'
labels:
  - tooling
  - ci
milestone: m-13
dependencies: []
modified_files:
  - package.json
  - knip.json
  - .github/workflows/ci.yml
parent_task_id: BACK-492
priority: medium
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`knip` detects unused exports, unreferenced files, and dead dependencies. It is zero-config for TypeScript/Bun and well-maintained (~800k weekly downloads, active 2025). Adding it to CI surfaces dead code that accumulates silently as the codebase evolves — especially relevant given the number of exported symbols in `src/utils/` and `src/core/`.

**Implementation plan:**
1. `bun add -d knip`
2. Create `knip.json`: `entry: ["src/cli.ts"]`, `project: ["src/**/*.ts"]`; exclude test files from unused-exports checks
3. Run first pass; baseline all existing violations in `knip.json` (`ignoreDependencies`, `ignoreExportsUsedInFile`) to establish a clean slate for new violations
4. Add CI step to `.github/workflows/ci.yml`: `bunx knip --reporter compact`
5. Optional: add `drenso/knip-reporter` GH Action for PR annotation
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 knip added to devDependencies in package.json
- [ ] #2 knip.json config present, scoped to src/, with baselined existing violations
- [ ] #3 CI step added to ci.yml and passes on main branch
- [ ] #4 Any new unused export introduced in a subsequent PR causes CI to fail
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
