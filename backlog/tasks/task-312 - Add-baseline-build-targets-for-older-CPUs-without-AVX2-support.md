---
id: task-312
title: Add baseline build targets for older CPUs without AVX2 support
status: In Progress
assignee: []
created_date: '2025-10-29 18:13'
updated_date: '2025-10-29 18:20'
labels:
  - bug
  - ci-cd
  - compatibility
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add baseline build targets (bun-windows-x64-baseline and bun-linux-x64-baseline) to both CI and release workflows to support users with older CPUs (pre-2013) that lack AVX2 instructions.

## Problem
Users with older CPUs (Intel i7-3770, i7-3612QE) are getting "Illegal instruction" errors because the current build targets require AVX2 (Haswell architecture, 2013+). These 3rd gen Intel Core processors only support AVX, not AVX2.

## Root Cause
- Current builds use `--target=bun-windows-x64` and `--target=bun-linux-x64` which require AVX2
- Affected CPUs only support AVX (Ivy Bridge architecture, 2012)
- Bun's standard x64 builds target Haswell architecture (AVX2 required)

## Solution
Add baseline build targets to support Nehalem architecture (2008+) with SSE4.2:
- `bun-windows-x64-baseline`
- `bun-linux-x64-baseline`

These baseline builds are slightly slower but will work on CPUs from 2008-2013 that lack AVX2.

## Files to Modify
1. `.github/workflows/release.yml` - Add baseline targets to build matrix and publish steps
2. `.github/workflows/ci.yml` - Add baseline targets to build-test job to keep CI in sync

## References
- Issue #412: https://github.com/MrLesk/Backlog.md/issues/412
- Bun baseline documentation: https://bun.sh/docs/bundler/executables
- CPU requirements: i7-3770 (Ivy Bridge) has AVX but NOT AVX2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Release workflow builds both standard and baseline binaries for Windows and Linux x64
- [x] #2 CI workflow tests both standard and baseline builds to ensure they work
- [x] #3 Baseline binaries are published as separate npm packages (e.g., backlog.md-windows-x64-baseline)
- [x] #4 GitHub releases include baseline binaries alongside standard ones
- [x] #5 Smoke tests in CI verify both standard and baseline binaries work
- [x] #6 Documentation updated to mention baseline builds for older CPUs
<!-- AC:END -->
