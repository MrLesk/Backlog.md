---
id: BACK-240
title: Improve binary resolution on Apple Silicon (Rosetta/arch mismatch)
status: In Progress
assignee:
  - '@alex-agent'
created_date: '2025-08-17 17:00'
updated_date: '2026-07-04 14:17'
labels:
  - packaging
  - bug
  - macos
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On M1/M2 Macs, users can have Node/Bun running under Rosetta (x64) while the OS/CPU is arm64. This can cause the wrapper to resolve the wrong platform package or for the package manager to install only one variant, leading to errors like "illegal hardware instruction" or "Binary package not installed..." (see #265).

Goals:
- Make the binary resolver more robust on macOS by detecting Rosetta and falling back to available variants.
- Provide clear, actionable error messages with guidance.
- Add install docs for Apple Silicon (brew paths, Rosetta, arch checks).

Scope (MVP):
- In scripts/resolveBinary.cjs: if require.resolve fails, try both `backlog.md-darwin-arm64` and `backlog.md-darwin-x64` and spawn the one that exists.
- Detect Rosetta (e.g., `sysctl -in sysctl.proc_translated` returns 1) and include a hint in the error/help output.
- Improve error message: show detected `process.platform/process.arch`, Rosetta status, and which package name was looked up; suggest reinstalling via the matching arch tool (e.g., /opt/homebrew vs /usr/local, or `arch -arm64 npm i -g backlog.md`).
- README note: Apple Silicon troubleshooting steps and how to verify/install matching architecture for Node/Bun/Homebrew.

Out of scope: universal binaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Resolver: on macOS, if default resolution fails, attempt both darwin-arm64 and darwin-x64 package names and run whichever exists
- [x] #2 Detect Rosetta and include it in error/help output (Rosetta: yes/no)
- [x] #3 Error/help output explains how to fix: verify brew path, reinstall with correct arch, commands to check process.arch/uname -m
- [x] #4 Add README troubleshooting section for Apple Silicon installs (brew/npx/bun)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/resolveBinary.cjs: add darwin arch fallback (try native arch package first, then the sibling darwin arch), expose candidate package names and Rosetta detection via sysctl.proc_translated.
2. scripts/cli.cjs: on resolution failure, ENOENT, or SIGILL crash, print detected platform/arch, Rosetta status, tried packages, and concrete remediation (uname -m / node -p process.arch, /opt/homebrew vs /usr/local brew, arch -arm64 reinstall commands); stop exiting 0 when the child dies from a signal.
3. README.md: add Troubleshooting > Apple Silicon (macOS) section with arch checks and native-arch reinstall commands for brew/npm/bun.
4. src/test/resolveBinary.test.ts: cover the resolution matrix (darwin fallback both directions, no fallback on linux/win32, .exe suffix, both-missing error, Rosetta detection short-circuit off darwin).
5. Gates: bunx tsc --noEmit, bun run check ., bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: scripts/resolveBinary.cjs now builds an ordered candidate list (native darwin arch first, sibling darwin arch as fallback; no fallback on linux/windows or unknown darwin arches), exposes getCandidatePackageNames + isRosettaTranslated (sysctl -in sysctl.proc_translated), and resolveBinaryPath accepts an injectable resolver for tests. scripts/cli.cjs prints detected platform-arch, Node version, Rosetta yes/no, tried package names, and macOS remediation commands (node -p process.arch vs uname -m, /opt/homebrew vs /usr/local brew reinstall, arch -arm64 npm/bun reinstall) on resolution failure, ENOENT, EBADARCH/ENOEXEC spawn errors, and SIGILL/SIGTRAP child crashes; child signal deaths now exit 1 instead of 0. README gained Troubleshooting > Apple Silicon (macOS) (anchor #apple-silicon-macos referenced by the error output). Simplified legacy mapPlatform/mapArch switches into getPackageName.

Validation: bun test src/test/resolveBinary.test.ts (15 pass, resolution matrix incl. both fallback directions, linux/win32 no-fallback, .exe suffix, both-missing error, Rosetta short-circuit). Full bun test: 1390 pass / 1 fail - the failing 'CLI Priority Filtering > case insensitive priority filtering' 5s timeout also fails on untouched main at the same commit (pre-existing flake, unrelated). bunx tsc --noEmit clean; biome check clean on changed files (bun run check . cannot run from this worktree because its path is under .claude/, which biome.json excludes). Manual smoke tests: missing packages -> guidance + exit 1; arm64 host with only darwin-x64 package -> fallback binary spawned with args, exit code propagated; SIGILL child -> arch guidance + exit 1; happy path spawns installed darwin-arm64 binary.
<!-- SECTION:NOTES:END -->
