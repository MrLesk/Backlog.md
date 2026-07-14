---
id: BACK-372
title: 'CI: drop sourcemap in compile-and-smoke-test to avoid InvalidSourceMap flake'
status: Done
assignee:
  - '@codex'
created_date: '2026-01-21 21:26'
updated_date: '2026-01-21 21:27'
labels: []
dependencies: []
references:
  - >-
    https://github.com/MrLesk/Backlog.md/actions/runs/21226066767/job/61073229991?pr=494
  - 'https://github.com/MrLesk/Backlog.md/pull/496'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI compile-and-smoke-test intermittently fails on Ubuntu with `InvalidSourceMap` from `bun build ... --sourcemap`. Remove `--sourcemap` from the smoke-test build step (keep release builds unchanged).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 compile-and-smoke-test build step no longer passes `--sourcemap` in CI.
- [x] #2 Release workflow still builds with sourcemaps as before.
- [x] #3 No other CI steps are removed or altered.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Edit .github/workflows/ci.yml compile-and-smoke-test build step to remove --sourcemap.
2) Ensure release workflow remains unchanged.
3) Confirm no other CI steps are modified.
4) Summarize change and note tests (not run for workflow change).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed `--sourcemap` from CI compile-and-smoke-test build step to avoid Bun InvalidSourceMap flake. Release workflow unchanged. Tests not run (workflow-only change).

PR: https://github.com/MrLesk/Backlog.md/pull/496
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
