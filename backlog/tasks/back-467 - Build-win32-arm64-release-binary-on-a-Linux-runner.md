---
id: BACK-467
title: Build win32-arm64 release binary on a Linux runner
status: In Progress
assignee:
  - '@claude'
created_date: '2026-05-30 18:14'
updated_date: '2026-05-30 18:17'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/26691062555'
  - 'https://github.com/MrLesk/Backlog.md/issues/657'
modified_files:
  - .github/workflows/release.yml
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v1.45.2 release (GitHub Actions run 26691062555) failed. `build-bun-windows-arm64` failed at the "Compile standalone binary" step with:

    Failed to extract executable for 'bun-windows-aarch64-v1.3.11'. The download may be incomplete.

`bun install --frozen-lockfile` passes — the failure is purely the compile step. `bun build --compile --target=bun-windows-arm64` downloads Bun's windows-aarch64 *runtime* (separate from the npm package) to embed in the standalone exe, and that download/extract is flaky on the Windows runner (same family as the existing baseline "Prime Bun cache (Windows workaround)" step, which is gated on 'baseline' and so skipped for arm64). Cross-compiling on a non-Windows host avoids it (verified locally: macOS→bun-windows-arm64 produces a valid Aarch64 PE32+ exe).

Separately, the build matrix has no `fail-fast: false`, so the arm64 failure cancelled the otherwise-passing `build-bun-windows-x64-baseline` job. Follow-up to BACK-466 / issue #657.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 build-bun-windows-arm64 builds on ubuntu-latest (cross-compile) and produces a valid windows-arm64 (.exe) artifact
- [x] #2 build matrix sets fail-fast: false so one platform's failure does not cancel the other platform builds
- [ ] #3 Release workflow proceeds past the build stage for all 6 platforms on the next tagged release
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Two edits to .github/workflows/release.yml:
1. build matrix: add `fail-fast: false` so one platform's failure can't cancel the others (it cancelled windows-x64-baseline in run 26691062555).
2. Move the bun-windows-arm64 build from `os: windows-latest` to `os: ubuntu-latest`. All Windows-specific steps key off `matrix.target` (contains 'windows'), not the runner OS, so BIN=.exe, the skipped chmod, and the skipped baseline-priming all still behave correctly. Bun cross-compiles to windows-arm64 from any host.

Verified: installed bun 1.3.11 (CI's pinned version) and ran `bun build --compile --target=bun-windows-arm64` on macOS — it downloaded and extracted bun-windows-aarch64-v1.3.11 (the exact runtime that failed on the Windows runner) and produced a valid Aarch64 PE32+ Windows exe. Confirms the extraction failure is Windows-host-specific; a non-Windows (Linux) host resolves it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
release.yml only runs on tag push, so this can't be exercised by PR CI — it's validated on the next tagged release (re-tag after merge, e.g. v1.45.3). Cross-compile verified locally with the exact CI bun version (1.3.11) on a non-Windows host. YAML validated with ruby. AC#3 (full release proceeds) remains unchecked until a real release run confirms it.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
