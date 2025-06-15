---
id: task-61
title: Embed blessed in standalone binary
status: In Progress
assignee: @codex
created_date: '2025-06-14'
labels:
  - cli
  - packaging
dependencies: []
parent_task_id:
---

## Description

When running the Backlog CLI installed from npm, the compiled executable fails if `blessed` isn't available in the current project. This prevents usage in non‑JavaScript repositories. Update the build process so that the standalone binary bundles `blessed` and other npm dependencies directly.

## Acceptance Criteria
- [ ] Build scripts compile without `--external blessed`
- [ ] CI and release workflows build binaries that include dependencies
- [ ] `backlog` runs globally without installing blessed locally
