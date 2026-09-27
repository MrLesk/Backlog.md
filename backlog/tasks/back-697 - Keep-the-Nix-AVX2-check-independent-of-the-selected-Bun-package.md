---
id: BACK-697
title: Keep the Nix AVX2 check independent of the selected Bun package
status: Done
assignee:
  - '@codex-nix-check'
created_date: '2026-09-27 22:27'
updated_date: '2026-09-27 22:33'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1009'
  - 'https://github.com/MrLesk/Backlog.md/pull/802'
  - >-
    https://github.com/NixOS/nixpkgs/commit/e439af0fbc7197adb2c600a537511828d5c6adb7
  - 'https://github.com/oven-sh/bun/releases/tag/bun-v1.3.13'
modified_files:
  - flake.nix
  - DEVELOPMENT.md
type: bug
ordinal: 327000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A newer nixpkgs revision selects Bun baseline, but the Nix install check treats that selected archive as a known AVX2-only negative control and invokes a path it does not contain. Use an explicit known control archive while preserving the existing packaged Backlog checks on the Ivy Bridge CPU model and native package smoke checks. Do not update the flake lock or change platform support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The negative CPU compatibility control uses a known AVX2 archive independent of nixpkgs Bun source selection.
- [x] #2 Existing positive Backlog checks under Ivy Bridge emulation and native installed-package smoke checks remain in place.
- [x] #3 Validation covers the locked nixpkgs input and the issue-reported Bun 1.3.13 baseline input as far as the available build environment allows, with any unrun build stated explicitly.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Not applicable: bunx tsc --noEmit; no TypeScript changed.
- [x] #2 Not applicable: bun run check .; only Nix and Markdown changed. Scoped git diff --check passed.
- [x] #3 Not applicable: bun test; this change affects Nix packaging. Official archive hash, integrity, and executable path checks passed.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin avx2BunArchive in flake.nix directly to the official Bun 1.3.13 bun-linux-x64.zip archive with SHA-256 SRI sha256-ecB3H6i5LDOq5B4VoODTB+qZ0OLwAxfHHGxTI3p44lo=. Keep fetching the archive so the normal Bun derivation is not realized for this control.
2. Keep runtime selection, supported systems, native installed-package smoke, QEMU Ivy Bridge exit-132 control, positive CLI version/help checks, and emulation-only JIT settings unchanged. Update the matching DEVELOPMENT.md sentence.
3. Verify the complete official archive bytes, hash, ZIP integrity, and bun-linux-x64/bun path. Compare the unchanged installCheckPhase and remaining flake against HEAD; check the owned diff and unchanged flake.lock.
4. Compare source selection in locked nixpkgs 61b7c44c4073f0b827768aff0049561b5110ea5a and issue override c043004d1c6985732bcc1cbc5a9c9aecbbb4e0f0. Record that local Nix evaluation and both builds are unavailable. Fresh existing CI can prove only the locked input; no override build is claimed.
5. Keep the direct fetch pin after subtraction and architecture review, then finalize the CLI task record and commit/push only flake.nix, DEVELOPMENT.md, and this record under coordinator authorization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research only, 2026-09-27: confirmed issue #1009 and PR #802. Both the current locked nixpkgs revision (61b7c44c4073f0b827768aff0049561b5110ea5a) and the issue's override (c043004d1c6985732bcc1cbc5a9c9aecbbb4e0f0) package Bun 1.3.13. Upstream commit e439af0fbc7197adb2c600a537511828d5c6adb7 changes only the x86 Linux source URL/hash from bun-linux-x64.zip to bun-linux-x64-baseline.zip. The existing flake still treats that selected source as AVX2-only and invokes bun-linux-x64/bun.
Pin provenance: the locked nixpkgs Bun package declares sha256-ecB3H6i5LDOq5B4VoODTB+qZ0OLwAxfHHGxTI3p44lo= for the normal x64 1.3.13 archive. Official oven-sh/bun release metadata independently reports SHA-256 79c0771fa8b92c33aae41e15a0e0d307ea99d0e2f00317c71c6c53237a78e25a; conversion to SRI matches exactly. Archive-byte verification and ZIP path inspection remain part of implementation validation.
Environment: Darwin arm64; nix, nix-instantiate, qemu-x86_64, limactl, colima, and orb are not on PATH. Docker CLI is installed, but both desktop-linux and default contexts report unavailable daemons. No Nix evaluation, Linux build, or QEMU runtime proof has been run. No tools, accounts, or builders were changed.
Scope: only flake.nix and the matching existing DEVELOPMENT.md wording need source changes. The native smoke script also covers MCP/browser behavior and must remain unchanged. Source-writer release is still pending; no source, test, documentation, ref, index, or commit changes made by this task.

Coordinator released the sole source-writer slot for BACK-697. Implementing only flake.nix and the matching DEVELOPMENT.md wording; preserve all existing runtime and compatibility checks. No finalization, commits, push, or other source changes until architecture review.

Implementation frozen for architecture review: flake.nix now fetches the fixed official Bun 1.3.13 AVX2 archive directly, and DEVELOPMENT.md describes that pinned control. Owned diff: 2 files, 7 insertions, 3 deletions. No lockfile, runtime selection, supported systems, CI, or other source changes.
Validation: downloaded all 39,125,828 bytes from the official GitHub release URL into memory; computed SHA-256 SRI equals sha256-ecB3H6i5LDOq5B4VoODTB+qZ0OLwAxfHHGxTI3p44lo=; ZIP integrity passes and members are bun-linux-x64/ and bun-linux-x64/bun. Static comparison against HEAD confirms the entire flake is unchanged except avx2BunArchive, including the complete native smoke and QEMU installCheckPhase. The full gate SHA-256 is 592cf74d80e6a5ffa1670201d45d95545eb2b075458e728485bafd0a80384fa4. git diff --check passes for both owned files; git diff --exit-code -- flake.lock passes.
Validation limit: nix, nix-instantiate, nixfmt, alejandra, and statix are unavailable. No Nix syntax evaluation, locked-input build, c043004 override build, or QEMU runtime check was run. Docker remains unavailable; no environment changes made. The source/hash comparison covers both selected Bun 1.3.13 inputs but does not prove either build. An unrelated full Bun suite was not run.
Subtraction review: one direct fetch binding and one matching documentation edit are sufficient. No new helper, layer, test file, or remaining task-scoped simplification identified. Frozen source SHA-256: flake.nix dc824a60f4d26fb33c2659ac4375849b1d171f3c47d544e54f210c3391d737b0; DEVELOPMENT.md 8da35a4376b76233cc693ce0d57205a49f16bb3ac6c517de486566bee359d049. No task finalization, commit, push, checkout, ref, or index changes.

Finalization authorized after architecture review recommended keeping the frozen diff unchanged, with no findings, and the coordinator presented that result to Alex. Rechecked reviewed source hashes and the empty Git index before finalization. All three acceptance criteria are supported by the archive/source evidence and preserved gate comparison above; criterion 3 explicitly permits validation within available tooling and records every unrun build. Default TypeScript/Biome/Bun checklist entries are restated as not applicable to avoid claiming commands that were not run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pinned the AVX2 negative-control archive to official Bun 1.3.13 independently of nixpkgs Bun source selection, fixing the baseline archive/path mismatch. Updated DEVELOPMENT.md. Native package smoke, positive and negative Ivy Bridge checks, JIT settings, runtime selection, supported systems, and flake.lock remain unchanged.
Verified the official 39,125,828-byte archive against SHA-256 SRI sha256-ecB3H6i5LDOq5B4VoODTB+qZ0OLwAxfHHGxTI3p44lo=, ZIP integrity, and bun-linux-x64/bun. The full installCheckPhase is byte-for-byte unchanged; scoped diff checks pass. Architecture review recommended keeping the change unchanged with no findings.
Local Nix evaluation, locked-input build, issue-override build, and QEMU execution were unavailable and were not run. TypeScript, Biome project checks, and Bun tests are not applicable to this Nix/Markdown-only change and were not claimed. The coordinator will monitor fresh locked-input CI; that does not prove the issue override was built.
<!-- SECTION:FINAL_SUMMARY:END -->
