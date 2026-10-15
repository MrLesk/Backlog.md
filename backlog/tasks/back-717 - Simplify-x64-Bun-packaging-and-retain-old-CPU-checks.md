---
id: BACK-717
title: Simplify x64 Bun packaging and retain old-CPU checks
status: Done
assignee:
  - '@Codex'
created_date: '2026-10-11 10:18'
updated_date: '2026-10-11 10:23'
labels: []
dependencies:
  - BACK-716
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1076'
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - flake.nix
  - README.md
  - DEVELOPMENT.md
modified_files:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - flake.nix
  - README.md
  - DEVELOPMENT.md
type: chore
ordinal: 339000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use Bun 1.4.3 unified x64 compile targets and the normal Nix x64 archive while preserving package names, Windows cache priming, and the independent QEMU compatibility checks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI and release use unified x64 target names and still publish the same six platform packages.
- [x] #2 Nix selects the verified unified x64 runtime and retains the fixed AVX2 negative control and positive Ivy Bridge checks.
- [x] #3 All six release targets compile; native smoke and CI validate available platforms and old-CPU compatibility.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace baseline compile target aliases consistently in CI and release matrices/artifact references. Keep Windows cache priming tied explicitly to the Windows x64 target.
2. Select the normal Bun 1.4.3 Nix x64 archive and update matching runtime documentation. Preserve the complete QEMU install check.
3. Verify archive byte identity, cross-compile all six targets with bytecode, run native smoke, and inspect GitHub platform/Nix checks.
4. Finalize the task and link the executable PRs with native gh stack metadata.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CI/release targets and artifact mappings use bun-linux-x64 and bun-windows-x64. The six npm platform package names are unchanged, and the Windows x64 cache primer is preserved with an explicit target condition. Nix selects the normal Bun 1.4.3 x64 archive.
Verified official archive SHA-256 and ZIP integrity; normal and baseline archives contain the identical runtime SHA-256 7ce7d6b654eddeec20afddf2396317fba6dc19ab52788a27e894e1806bf8f24b. The entire Nix installCheckPhase is byte-for-byte unchanged, including the fixed 1.3.13 AVX2 negative control and positive version/help checks.
All six release targets compiled locally with bytecode (linux x64/arm64, darwin x64/arm64, windows x64/arm64). Native Darwin arm64 CLI/browser/MCP smoke passes. Biome and diff checks pass. No TypeScript source changed in this task; its type-check DoD is not applicable. Unified target native platform and Nix execution will be verified by this PR CI before finalization.

GitHub unified-target CI run 38131550945 passed compiled smoke on Linux x64, Windows x64, and macOS x64, plus macOS/Windows unit profiles and the Nix package job. The Nix job passed the unchanged native browser/MCP smoke and Ivy Bridge positive/negative compatibility checks using the normal x64 archive. The inherited bytecode PR full Linux/DOM suite also passed in run 38131455374.
Subtraction review removed only baseline aliases and made the existing Windows primer condition explicit. A pinned Bun version/source override is still required because the locked nixpkgs provides Bun 1.3.13; the old x86-only baseline override is gone. No platform support or npm package name changed. Linux/Windows ARM64 and macOS x64 binaries were cross-compiled locally; foreign execution is covered only where native CI runners are available.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Simplified Linux/Windows x64 target names and switched Nix to Bun 1.4.3's unified x64 archive. Preserved all six platform packages, the Windows cache primer, and the complete independent old-CPU check. All six bytecode release targets compile; native Darwin arm64 smoke and GitHub Linux/Windows/macOS compiled smoke pass. Nix native and Ivy Bridge positive/negative compatibility checks pass. The normal and baseline x64 runtime binaries are byte-identical.
<!-- SECTION:FINAL_SUMMARY:END -->
