---
id: BACK-370
title: 'Release: publish platform binaries before main npm package'
status: Done
assignee:
  - '@codex'
created_date: '2026-01-21 21:05'
updated_date: '2026-01-21 21:18'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/489'
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/21222914029'
  - 'https://github.com/MrLesk/Backlog.md/pull/494'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mitigate optional dependency race by publishing platform-specific binary packages before publishing the main `backlog.md` package, so installs won't fail when binaries lag behind the main publish.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Release workflow publishes platform binary packages before the main `backlog.md` npm package.
- [x] #2 Install sanity checks still run after both publishes.
- [x] #3 Workflow ordering is updated without removing existing build steps.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Inspect .github/workflows/release.yml dependencies/needs to understand current publish order.
2) Reorder jobs so publish-binaries runs before npm-publish while keeping build dependencies intact.
3) Update install-sanity to depend on both publishes (publish-binaries + npm-publish) after reordering.
4) Sanity-check workflow for circular dependencies; keep behavior equivalent aside from ordering.
5) Summarize changes and note tests (none expected for workflow-only change unless requested).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated release workflow ordering so `publish-binaries` runs before `npm-publish`, keeping `install-sanity` gated on both. No steps removed.

Tests not run (workflow-only change).

PR: https://github.com/MrLesk/Backlog.md/pull/494
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
