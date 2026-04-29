---
id: BACK-453
title: Stabilize Windows CI test suite
status: Done
assignee:
  - '@codex'
created_date: '2026-04-29 17:49'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows lint/unit CI is failing intermittently on main with test timeouts and EMFILE errors under the full Bun test suite. Stabilize the CI test command and/or affected tests so Windows CI is reliable without masking real failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Windows CI lint-and-unit-test completes reliably
- [x] #2 The fix avoids broad unrelated test rewrites
- [x] #3 Local targeted validation covers the changed CI/test behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched (not applicable; TypeScript was not touched)
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
