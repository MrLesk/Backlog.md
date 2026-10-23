---
id: BACK-788
title: Apply dependency patches in Nix builds and verify task persistence
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-23T06:39:00Z'
updated_date: '2026-10-23T06:43:00Z'
labels: []
dependencies:
  - BACK-787
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1133'
  - flake.nix
  - package.json
  - patches/gray-matter@4.0.3.patch
  - scripts/smoke-compiled-build.ts
modified_files:
  - scripts/smoke-compiled-build.ts
  - flake.nix
  - DEVELOPMENT.md
priority: high
type: bug
ordinal: 398000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1133 reports that Nix builds cannot read or write task frontmatter because the dependency cache does not apply the gray-matter patch required by js-yaml4. Native npm builds apply the patch. Ensure the same package metadata drives both installation paths and verify task persistence in the installed package.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Nix dependency cache applies the patches declared in package.json using bun2nix support; Bun and Nix builds use the same patch source.
- [ ] #2 The installed Nix CLI can create, read, list and edit a task with persisted frontmatter.
- [ ] #3 A failed task creation exits nonzero; packaged smoke checks detect missing task writes and unreadable task data.
- [ ] #4 Platform checks and the actual Nix package build pass for the completed stack.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Connect package.json patchedDependencies to bun2nix patchedDependenciesToOverrides in the flake. 2. Extend the existing installed CLI smoke check with create/view/list/edit persistence and a failed-create exit check; reproduce the missing-patch failure before validating the fix. 3. Verify both package routes in CI, review the final diff and publish the top PR in the requested GitHub stack.

Smoke-check authority: issue #1133 reproduces create failing without a task file and reads returning empty data. Existing installed-package smoke only checks version/help, browser assets and MCP availability. Extend that same smoke to create/view/list/edit one task, verify its actual saved title and metadata, and force one real write failure to require a nonzero exit. The actual Nix install check already calls this script, so no new test framework or duplicate package-specific test is needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced #1133 in an isolated bundle using the unpatched gray-matter dependency: expanded smoke fails at task create with yaml.safeDump and exit1. Current CLI already reports this failure with a nonzero status; no new CLI error handler is needed. Flake now uses the official bun2nix2.1.2 patch helper with package.json paths. The same installed-package smoke checks task persistence and a real blocked-directory write failure.

Types and Biome pass. The expanded smoke check passes against the patched JavaScript bundle and a real compiled native executable, including browser/MCP startup and the nonzero write-failure check. The flake helper call matches the official bun2nix2.1.2 patched-dependency example. Actual Nix package evaluation and the patched cache require GitHub CI.
<!-- SECTION:NOTES:END -->
