---
id: BACK-398
title: Investigate and fix backlog.md-linux-x64 dependency issue
status: Done
assignee: []
created_date: '2026-02-23 22:08'
updated_date: '2026-02-23 22:17'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The optionalDependencies in package.json includes platform-specific packages but is missing `backlog.md-linux-x64` (x64 architecture for Linux). Only `backlog.md-linux-arm64` is listed. This may cause issues with `bun link` when linking the wrong version.

Verify if linux-x64 is actually needed for the build/release process, and if not, ensure it's not being linked incorrectly.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
