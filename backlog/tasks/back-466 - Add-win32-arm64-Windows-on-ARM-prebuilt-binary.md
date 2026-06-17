---
id: BACK-466
title: Add win32-arm64 (Windows on ARM) prebuilt binary
status: Done
assignee:
  - '@claude'
created_date: '2026-05-30 14:05'
updated_date: '2026-05-30 17:39'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/657'
modified_files:
  - .github/workflows/release.yml
  - package.json
  - scripts/postuninstall.cjs
  - src/test/resolveBinary.test.ts
  - biome.json
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows on ARM (e.g. Snapdragon Surface devices) users get `Binary package not installed for win32-arm64.` on every command after `npm i -g backlog.md`, because no `backlog.md-windows-arm64` platform package is built or published. Reported in GitHub issue #657.

The binary resolver (`scripts/resolveBinary.cjs`) and launcher (`scripts/cli.cjs`) already handle arbitrary platform/arch generically, so no runtime code changes are needed. Bun v1.3.10+ (the release pipeline uses 1.3.11) natively cross-compiles to `bun-windows-arm64` (verified locally: produces an Aarch64 PE32+ executable). The fix is purely additive packaging/release config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Release pipeline builds a bun-windows-arm64 standalone binary and publishes a backlog.md-windows-arm64 npm package (os win32, cpu arm64) on tagged release
- [x] #2 backlog.md-windows-arm64 is declared in optionalDependencies in both the source package.json and the npm-publish job's generated package.json
- [x] #3 postuninstall cleanup list and the verify-platform-packages metadata wait list include backlog.md-windows-arm64
- [x] #4 resolveBinary test asserts getPackageName('win32','arm64') === 'backlog.md-windows-arm64'
- [x] #5 bun test, bunx tsc --noEmit, and bun run check . all pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Packaging/release config only — no runtime code (resolver/launcher in scripts/ are already arch-generic). Bun ≥1.3.10 (pipeline uses 1.3.11) cross-compiles bun-windows-arm64.

1. .github/workflows/release.yml:
   - build matrix: add { os: windows-latest, target: bun-windows-arm64 }.
   - publish-binaries matrix: add { target: bun-windows-arm64, package: backlog.md-windows-arm64, os: win32, cpu: arm64 }.
   - verify-platform-packages metadata list: add backlog.md-windows-arm64.
   - npm-publish: derive published versions from source via `.optionalDependencies |= map_values("$TAG")` instead of a hardcoded list (single source of truth).
2. package.json: list all 6 platform packages (incl backlog.md-windows-arm64) in optionalDependencies with "*".
3. scripts/postuninstall.cjs: add backlog.md-windows-arm64 to the cleanup list.
4. src/test/resolveBinary.test.ts: assert getPackageName("win32","arm64") === "backlog.md-windows-arm64".
5. biome.json: override **/package.json to space/2 (match the jq-written file; stops the pre-commit hook from reformatting it to tabs).

One-time bootstrap (maintainer, before the first release that references it): npm trusted publishing (OIDC) cannot create a brand-new package, so backlog.md-windows-arm64 must be published manually once and have a trusted publisher configured on npmjs.com. Otherwise the release breaks broadly: publish-binaries fails on the new package, verify-platform-packages times out, and the main backlog.md npm-publish (which needs it) is skipped.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified locally: bun cross-compiles bun-windows-arm64 to an Aarch64 PE32+ binary; the simulated publish jq emits all 6 platforms at the exact tag; `bun run check .` clean (287 files); resolveBinary test 3/3; frozen+isolated `bun install` exits 0 (windows-arm64 "*" only warns 404 until first publish — harmless); bun.lock/bun.nix untouched. Design follows the esbuild/@biomejs/biome/turbo/bun and Bun-compiled muxinc/cli pattern: a single platform list in the manifest, with a shim that resolves and spawns the matching binary. Known follow-ups (out of scope): bun.lock pins platform packages at a stale 1.14.4 (artifact of "*" versions); publish-binaries lacks fail-fast:false so one platform failure can cancel the others.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PR #664 (https://github.com/MrLesk/Backlog.md/pull/664) closes issue #657. Adds a native bun-windows-arm64 build + backlog.md-windows-arm64 platform package so the CLI runs on Windows on ARM instead of failing with "Binary package not installed for win32-arm64." Packaging/release config only — no runtime code. The npm-publish job now derives optionalDependencies from the single source list in package.json via map_values("$TAG"); also adds a biome.json package.json 2-space override. Requires a one-time manual bootstrap publish of backlog.md-windows-arm64 + trusted-publisher setup (npm OIDC can't first-publish a new package), after which CI releases handle it.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
