---
id: task-336
title: Rollback GitHub workflows to Bun 1.2.x to avoid websocket CPU regression
status: In Progress
assignee:
  - '@codex'
created_date: '2025-12-06 20:30'
updated_date: '2025-12-06 20:36'
labels:
  - bug
  - infra
  - ci
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upstream Bun 1.3.x has a websocket regression (oven-sh/bun#23536) that causes backlog browser to spike CPU (Backlog.md#448 reports 100% CPU on macOS Sequoia 15.7). CI currently runs Bun 1.3.3; we need to pin GitHub workflows back to the latest Bun 1.2.x until the regression is fixed. Steps: (1) confirm current Bun version used in GitHub workflows and release CI; (2) update workflow setup steps to install/pin Bun 1.2.x (latest patch) consistently across all jobs; (3) verify no scripts or docs conflict with the pin and adjust if needed; (4) validate that lint/test/build steps still work with 1.2.x.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All GitHub Actions workflows that install Bun are pinned to Bun 1.2.x (latest patch).
- [ ] #2 Workflow comments or docs note the websocket CPU regression as the reason for pinning.
- [ ] #3 Checks (lint/test/build) succeed with the pinned version.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Pinned GitHub workflows (ci.yml, release.yml) to Bun 1.2.23 with inline comments referencing oven-sh/bun#23536 and Backlog.md#448; cache keys now include version to avoid cross-version reuse.

Verified locally with Bun 1.2.23 (downloaded binary) running bun install --frozen-lockfile --linker=isolated, bun run lint, and bun test (all passing).
<!-- SECTION:NOTES:END -->
