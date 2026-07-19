---
id: BACK-554
title: Package Backlog.md with bun2nix v2
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 12:31'
updated_date: '2026-07-19 14:05'
labels:
  - nix
  - packaging
  - ci
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/801'
  - 'https://github.com/MrLesk/Backlog.md/issues/584'
  - 'https://nix-community.github.io/bun2nix/'
modified_files:
  - .github/workflows/ci.yml
  - DEVELOPMENT.md
  - README.md
  - bun.nix
  - flake.lock
  - flake.nix
  - package.json
  - scripts/build.ts
  - scripts/smoke-compiled-build.ts
  - scripts/update-nix.sh
  - src/server/index.ts
priority: high
type: bug
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md must build and run through Nix using the current bun2nix v2 workflow. Design the Nix package from the product requirements rather than preserving the existing implementation: install dependencies reproducibly, build the CLI and browser assets the repository actually needs, expose a runnable flake app and package, and verify the produced package on supported systems. Map that clean design onto the repository, implement the missing pieces, and remove superseded Nix machinery.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The default Nix package builds and the packaged backlog executable runs --version and a representative CLI command on x86_64-linux
- [x] #2 nix run from a source revision runs the Backlog.md version from that revision
- [x] #3 Dependencies are locked and installed reproducibly with the current bun2nix v2 API and a documented deterministic update command
- [x] #4 The Nix package contains the CLI and functional browser assets required by the normal product build
- [x] #5 The flake exposes a working default package, named package, default app, and development shell on x86_64-linux, aarch64-linux, and aarch64-darwin
- [x] #6 The x86_64-linux package runs on pre-AVX2 CPUs through a baseline Bun runtime without using that runtime as a compiler self-image
- [x] #7 Superseded bun2nix v1 files, Docker-based lock generation, package-install side effects, and obsolete Nix workarounds are removed
- [x] #8 CI builds the Nix package and runs packaged CLI and browser smoke checks plus an older-x86 runtime gate on native x86_64-linux
- [x] #9 Nix installation, supported systems, older-x86 support, and dependency-lock update documentation match the implemented workflow
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin bun2nix v2, regenerate bun.nix in the v2 schema, and use fetchBunDeps plus the documented copyfile backend for an offline dependency install.
2. Extend the existing Bun build script with a non-compile bundle mode so Nix packages the CLI module and generated browser assets from the same production entrypoint. Keep normal release compilation unchanged.
3. Package that bundle with bun2nix.mkDerivation and wrap a Nix-managed Bun runtime. Use current Nixpkgs Bun on ARM systems and a version-matched official baseline Bun source on x86_64 Linux, only as the runtime.
4. Expose the default and named package, default app, and development shell on x86_64-linux, aarch64-linux, and aarch64-darwin.
5. Remove the v1 lock path, Docker update script, compiler overlay, package-install side effect, and obsolete workarounds.
6. Add native Linux packaged CLI/browser smoke plus an Ivy Bridge no-AVX2 execution gate, update Nix usage and lock-update documentation, and run repository-wide validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex approved x86_64-linux, aarch64-linux, and aarch64-darwin and requires retaining pre-AVX2 x86 support. bun2nix v2 provides fetchBunDeps and mkDerivation for the repository lock and build. Its default Linux link backend is rejected by Nix store permissions in this dependency graph, so the package uses bun2nix documentation’s cross-platform copyfile backend. A direct compiled package was rejected after reproducing #801 on the exact new artifact even without the old baseline overlay or Nix fixup: the Nixpkgs Bun compiler self-image exited 133 before CLI startup. The accepted architecture produces a non-compile bundle from the existing build entrypoint and runs it with Nix-managed Bun. x86_64 Linux overrides only the current Nixpkgs Bun source map with the version-matched official baseline archive; the baseline binary is never used for compilation. The installed wrapper passed version, help, init, representative CLI, MCP, and browser HTML/CSS/JS/favicon smoke checks. It also executes the full CLI under QEMU’s Ivy Bridge CPU model with no AVX2. BUN_JSC_useJIT=false is limited to that emulated validation because Bun JSC crashes under QEMU user mode with JIT enabled, even for a one-line script; normal packaged execution retains JIT.

Final validation: bun2nix regeneration produced an identical bun.nix hash; TypeScript and Biome checks passed; the full suite passed 1,729 tests with 4 intentional skips and 0 failures; the normal compiled release smoke passed; flake evaluation exposed package, app, and development shell outputs on all three approved systems; flake check, Nix build, installed CLI/browser smoke, and nix run passed on x86_64 Linux. The older-CPU gate is discriminating: standard Nixpkgs Bun exits with SIGILL under QEMU Ivy Bridge while the official baseline runtime runs the packaged CLI. Remaining limitation: JSC JIT is disabled only for QEMU user-mode validation because the emulator crashes JSC with JIT enabled; native packaged smoke retains JIT.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt Nix packaging from the current bun2nix v2 workflow, producing a reproducible runtime-wrapped CLI with browser assets and a runnable flake across the approved systems. Removed the v1 and Docker-era machinery, added CI and deterministic lock validation, and documented installation and maintenance. Verified with repository-wide checks, compiled and packaged smoke tests, nix run, and a discriminating pre-AVX2 runtime gate.
<!-- SECTION:FINAL_SUMMARY:END -->
