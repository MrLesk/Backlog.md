---
id: BACK-373
title: 'Release: retry Windows install-sanity when binary package missing'
status: Done
assignee:
  - '@codex'
created_date: '2026-01-21 21:46'
updated_date: '2026-01-21 21:47'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/21226648942'
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/21226648942#logs'
  - 'https://github.com/MrLesk/Backlog.md/pull/497'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Install-sanity on Windows intermittently fails with "Binary package not installed for win32-x64" right after release publish. Add a retry/backoff in the Windows install-sanity step to handle npm registry propagation and optional dependency lag.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Windows install-sanity step retries npm install/backlog -v on failure with a short delay.
- [x] #2 Non-Windows install-sanity steps are unchanged.
- [x] #3 Release workflow continues to run install-sanity after publishes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Update release workflow Windows install-sanity step to retry on missing binary (non-zero exit) with backoff.
2) Keep Unix install-sanity step unchanged.
3) Verify job dependencies unchanged (install-sanity still after publishes).
4) Summarize change and note tests not run for workflow-only update.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added retry loop with backoff to Windows install-sanity step to handle optional dependency propagation. Unix steps unchanged. Tests not run (workflow-only change).

PR: https://github.com/MrLesk/Backlog.md/pull/497
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
