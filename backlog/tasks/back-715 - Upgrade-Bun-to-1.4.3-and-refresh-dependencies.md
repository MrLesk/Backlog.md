---
id: BACK-715
title: Upgrade Bun to 1.4.3 and refresh dependencies
status: Done
assignee:
  - '@Codex'
created_date: '2026-10-11 10:03'
updated_date: '2026-10-11 10:17'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1073'
  - package.json
  - bun.lock
  - bun.nix
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - src/web/utils/mermaid.ts
  - src/commands/task-wizard.ts
  - biome.json
  - src/test/malformed-task-dependencies.test.ts
  - src/test/vacated-task-references.test.ts
  - flake.nix
  - flake.lock
  - src/utils/task-search.ts
  - src/test/board-tui-move.test.ts
  - src/file-system/operations.ts
  - src/test/config-commands.test.ts
  - src/test/react-dom-preload.test.ts
  - DEVELOPMENT.md
modified_files:
  - package.json
  - bun.lock
  - biome.json
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - src/commands/task-wizard.ts
  - src/web/utils/mermaid.ts
  - src/test/malformed-task-dependencies.test.ts
  - src/test/vacated-task-references.test.ts
  - bun.nix
  - flake.nix
  - flake.lock
  - src/utils/task-search.ts
  - src/test/board-tui-move.test.ts
  - src/file-system/operations.ts
  - src/test/config-commands.test.ts
  - src/test/react-dom-preload.test.ts
  - DEVELOPMENT.md
type: chore
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upgrade CI and release builds to Bun 1.4.3, refresh all direct packages to latest stable releases, and resolve migration issues without changing documented product behavior. Bytecode, built-in type checking, and x64 simplification are separate follow-ups.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI and release builds use Bun 1.4.3 and direct dependencies use latest stable releases available during implementation.
- [x] #2 Breaking dependency changes are resolved while preserving existing CLI, MCP, and browser behavior.
- [x] #3 The Bun lockfile and generated Nix dependency metadata are consistent with package.json.
- [x] #4 Type checking, Biome, the full test suite, and compiled executable smoke checks pass, with platform limits documented.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Upgrade CI, release, and the three supported Nix runtimes to Bun 1.4.3; refresh all direct packages and wildcard platform resolutions and upgrade bun2nix to 2.1.2.
2. Resolve Clack, Mermaid, Fuse, Bun YAML, and jsdom changes while preserving product behavior. Make asynchronous TUI tests wait for completion and clean up after failures.
3. Regenerate dependency metadata, verify archive hashes, and run type checking, Biome, full CI profiles, interactive TUI, and compiled/browser/MCP smoke checks.
4. Review the diff for simpler code, finalize the task, and open a scoped draft PR for the executable and checker follow-ups.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated all direct development packages to latest stable registry versions, refreshed wildcard platform packages without changing their public wildcard declarations, and upgraded bun2nix to 2.1.2. Bun is pinned to 1.4.3 in CI, release, and all three supported Nix runtimes.
Resolved Clack text-prompt typing with explicit back-navigation state; preserved Mermaid classic/dagre rendering; preserved one-character task searches after Fuse 7.5; retained legacy indented config support under Bun YAML; adjusted jsdom resource-cleanup verification and an asynchronous footer assertion.
Validation so far: TypeScript and Biome pass; 87 migration/search/wizard/TUI tests and 28 config/preload tests pass; compiled CLI/browser/MCP smoke passes; real browser Mermaid SVG renders without console warnings/errors. Direct-package outdated check is empty. The full profile rerun is in progress. An interactive macOS board editor test timed out under concurrent load, then passed alone. Nix evaluation/build requires GitHub CI because Nix is not installed locally. bun2nix lock hash was calculated from the official release archive using canonical NAR serialization, first verified against the existing 2.1.1 hash.

Final validation: local full CI profile passed 2,561 non-DOM tests (8 intentional skips) plus 316 DOM tests, with zero failures. All 6 interactive PTY tests pass. TypeScript, Biome, git diff --check, compiled CLI/browser/MCP smoke, and real-browser Mermaid SVG checks pass.
GitHub CI run 38131084372 passed all seven platform/compile/Nix jobs. Nix built the pinned runtime and offline dependency cache and passed native smoke plus the existing Ivy Bridge positive/negative checks. Official Bun 1.4.3 archive hashes and ZIP integrity were verified for all three Nix platforms; normal and baseline Linux x64 archives contain byte-identical runtime binaries.
The longer TUI waits are bounded condition checks, not unconditional sleeps; failed test callbacks now close the board before destroying its screen. Subtraction review kept the existing build and search/config helpers and introduced no new application layer.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Upgraded Bun to 1.4.3 across CI, releases, and Nix; refreshed all direct packages and both dependency locks; upgraded bun2nix to 2.1.2. Resolved prompt, diagram, search, YAML, and DOM-test migrations while preserving existing behavior. Local full profile passed 2,877 tests with 8 intentional skips; all 6 interactive tests, TypeScript, Biome, compiled/browser/MCP smoke, and real-browser Mermaid checks pass. GitHub platform and Nix CPU-compatibility checks passed. Follow-up PRs cover bytecode, built-in type checking, and unified x64 packaging.
<!-- SECTION:FINAL_SUMMARY:END -->
