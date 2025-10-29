---
id: task-313
title: Fix release workflow to use Bun 1.2.23 with standard x64 targets
status: In Progress
assignee: []
created_date: '2025-10-29 18:46'
updated_date: '2025-10-29 18:46'
labels:
  - bug
  - ci-cd
  - hotfix
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The release workflow is failing because it's trying to use baseline targets (bun-windows-x64-baseline, bun-linux-x64-baseline) with Bun 1.2.23, but baseline binaries aren't available for download during compilation with that version.

## Problem
- Release workflow uses Bun 1.2.23 (pinned due to task-311 bug fix)
- Trying to build with --target=bun-windows-x64-baseline fails
- Error: "Failed to extract executable for 'bun-windows-x64-baseline-v1.2.23'. The download may be incomplete."

## Root Cause
CI and release workflows are out of sync:
- CI: Tests with standard targets (no --target flag, works with 1.2.23)
- Release: Builds with baseline targets (fails with 1.2.23)

## Solution
Revert release workflow back to standard x64 targets to match CI:
- Use bun-linux-x64 (not baseline)
- Use bun-windows-x64 (not baseline)
- Keep Bun 1.2.23 in both CI and release (synced)

This means we can't support older CPUs without AVX2 until Bun fixes the bug that required pinning to 1.2.23.

## Files to Modify
- .github/workflows/release.yml - revert to standard x64 targets
<!-- SECTION:DESCRIPTION:END -->
