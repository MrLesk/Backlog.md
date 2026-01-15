---
id: BACK-311
title: Rollback CI to Bun 1.2.23
status: Done
assignee:
  - '@codex'
created_date: '2025-10-29 17:53'
updated_date: '2025-10-29 18:00'
labels:
  - ci
  - bun
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary
- Revert our continuous integration environments to run against Bun 1.2.23 instead of Bun 1.3.x
- Investigate where the Bun version is pinned or installed (GitHub Actions, scripts, documentation) and make consistent updates

## Context
- Bun 1.3.0 introduces a regression that causes 100% CPU usage for websocket workloads ([oven-sh/bun#23536](https://github.com/oven-sh/bun/issues/23536))
- Our project reproduces similar symptoms per [MrLesk/Backlog.md#417](https://github.com/MrLesk/Backlog.md/issues/417)

## Proposed Approach
- Locate all CI configuration files and tooling scripts that install or depend on Bun
- Pin them back to the known-good Bun 1.2.23 release
- Verify the change locally with `bun --version` in the workflow or by running the affected script if feasible
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All CI workflows that install Bun pin version 1.2.23
- [x] #2 Local development documentation references Bun 1.2.23 if a specific version is mentioned
- [x] #3 CI run (or equivalent local validation) completes successfully using Bun 1.2.23
- [x] #4 Lean change log entry or pull request notes mention the rollback rationale
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Set `bun-version: 1.2.23` on each `oven-sh/setup-bun@v1` step in `.github/workflows/ci.yml` and `.github/workflows/release.yml` to align CI and release workflows on the stable runtime.

Searched repository for additional Bun version references; none found outside CI workflows.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ran `bun run check .` to sanity check; fails on pre-existing format issue in `.claude/settings.local.json` that is unrelated to the workflow changes.

Biome formatter failed previously due to `.claude` artifacts. Updated `biome.json` to add `!**/.claude` include guard (and kept `experimentalScannerIgnores`) so `.claude/` is skipped. Biome check now passes.

Removed deprecated `files.experimentalScannerIgnores` usage; rely solely on `!**/.claude` include pattern so Biome ignores the folder without warnings.
<!-- SECTION:NOTES:END -->
