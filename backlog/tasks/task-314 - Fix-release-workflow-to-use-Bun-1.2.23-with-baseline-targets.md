---
id: task-314
title: Fix release workflow to use Bun 1.2.23 with baseline targets
status: In Progress
assignee: []
created_date: '2025-10-29 18:54'
updated_date: '2025-10-29 19:00'
labels:
  - bug
  - ci-cd
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The release workflow needs to be fixed to use Bun 1.2.23 (pinned from task-311) with baseline build targets for Linux x64 and Windows x64.

## Current State
- CI: Uses Bun 1.2.23, tests with standard targets (no explicit --target flag)
- Release: Uses latest Bun (no version pin), tries to build with baseline targets

## Required State
- CI: Uses Bun 1.2.23, tests with baseline targets explicitly
- Release: Uses Bun 1.2.23, builds with baseline targets

Both workflows must be in sync and use the same Bun version (1.2.23).

## Investigation Needed
1. Verify Bun 1.2.23 has baseline binaries available (confirmed: yes)
2. Test if bun build --compile --target=bun-windows-x64-baseline works with Bun 1.2.23
3. Identify why the release workflow failed (if it's a real issue or transient)

## Files to Modify
- .github/workflows/release.yml - Add bun-version: 1.2.23 to all setup-bun steps
- .github/workflows/ci.yml - Add baseline targets to build-test matrix (if needed for sync)

## Related
- Issue #412 - Users with older CPUs need baseline builds
- Task-311 - Bun pinned to 1.2.23 due to bug
- PR #421 - Added baseline targets (merged)
<!-- SECTION:DESCRIPTION:END -->
