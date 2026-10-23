---
id: BACK-788
title: Apply dependency patches in Nix builds and verify task persistence
status: Done
assignee:
  - '@codex'
created_date: '2026-10-23T06:39:00Z'
updated_date: '2026-10-23T07:18:00Z'
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
- [x] #1 The Nix dependency cache applies the patches declared in package.json using bun2nix support; Bun and Nix builds use the same patch source.
- [x] #2 The installed Nix CLI can create, read, list and edit a task with persisted frontmatter.
- [x] #3 A failed task creation exits nonzero; packaged smoke checks detect missing task writes and unreadable task data.
- [x] #4 Platform checks and the actual Nix package build pass for the completed stack.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

Verified actual Nix package at code commit a85a2a8: job120281148752 logs show bun2nix applying the gray-matter patch to lib/engines.js, then the installed Nix CLI passing the expanded persistence/browser/MCP smoke at 06:46:48 UTC. Windows, Linux and macOS unit checks, six native builds/install smoke, architecture comparison and CodeQL pass. The remaining Nix development-tool build is still running; this note does not claim the full job has finished. Local native and bundle smoke pass; types and Biome pass. Implementer specification/quality review confirms the patch is owned by package.json and the existing bun2nix adapter, with one shared installed-package smoke and no new runtime workaround. Full local suite has 3601 passes,13 skips and one unrelated terminal-display failure reproduced with clean-main source and a clean-main bundle. No groma files changed.

Full code CI at a85a2a8 completed successfully in https://github.com/MrLesk/Backlog.md/actions/runs/39913342581 including Nix package, development-tools and inherited-trust checks. Subsequent changes in the bottom task only correct test fixture setup and record results; this tasks application source and smoke behavior are unchanged. Corrected current Windows/Linux/macOS checks pass. Final automatic Nix checks on the recorded stack will gate merge. No Docker container was created because local Docker startup required macOS administrator approval on a locked Mac; Docker is fully closed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Nix applies package.json dependency patches through the official bun2nix helper, restoring task frontmatter reads and writes. Shared installed-package checks verify create/view/list/edit persistence and nonzero failed-write status. The unpatched reproduction fails; patched bundle, native executable and installed Nix package pass. Full Windows/Linux/macOS, six-build, Nix, architecture and CodeQL CI passed at a85a2a8. Delivered as PR#1137 above#1136 in GitHub stack#1138; final automatic checks gate merge.
<!-- SECTION:FINAL_SUMMARY:END -->
