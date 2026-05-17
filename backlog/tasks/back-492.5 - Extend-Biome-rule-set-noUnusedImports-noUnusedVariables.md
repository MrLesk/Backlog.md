---
id: BACK-492.5
title: 'Extend Biome rule set: noUnusedImports + noUnusedVariables'
status: To Do
assignee: []
created_date: '2026-05-17 21:12'
labels:
  - tooling
milestone: m-13
dependencies: []
modified_files:
  - biome.json
  - src/**/*.ts
parent_task_id: BACK-492
priority: low
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`biome.json` enables `recommended: true` plus 10 explicit style rules, but omits `nursery/noUnusedImports` and `correctness/noUnusedVariables`. These catch stale imports and dead local variables without requiring external tools — they are signals Biome already computes for free.

**Implementation plan:**
1. Add to `biome.json` linter section: `"nursery": { "noUnusedImports": "warn" }` and ensure `"correctness": { "noUnusedVariables": "warn" }` is set
2. Run `bun run check --write .` to auto-fix violations
3. Review remaining manual fixes; apply `_` prefix convention for intentionally unused vars or add `// biome-ignore` with reason
4. Confirm `bun run check .` passes cleanly in CI
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 nursery/noUnusedImports enabled in biome.json
- [ ] #2 correctness/noUnusedVariables enabled in biome.json
- [ ] #3 Zero violations on main branch (fixed or suppressed with biome-ignore + reason comment)
- [ ] #4 bun run check . passes in CI
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
