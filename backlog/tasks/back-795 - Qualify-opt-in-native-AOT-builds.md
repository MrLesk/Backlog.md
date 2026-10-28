---
id: BACK-795
title: Qualify opt-in native AOT builds
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-28T00:07:00Z'
updated_date: '2026-10-28T00:30:00Z'
labels: []
dependencies: []
references:
  - scripts/build.ts
  - scripts/prepare-bun-runtime.cjs
  - .github/workflows/release.yml
modified_files:
  - scripts/build.ts
  - scripts/prepare-bun-runtime.cjs
  - scripts/aot-compiler.json
  - .github/workflows/aot.yml
  - DEVELOPMENT.md
  - scripts/ci-trust.test.cjs
  - scripts/smoke-packaged-build.cjs
  - scripts/smoke-browser-build.cjs
ordinal: 403000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Native AOT currently requires a scratch wrapper and a manually patched terminal dependency. Establish repeatable native build and smoke qualification for the existing six release targets while keeping stable releases unchanged and the unpublished Blessed prerequisite explicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Default build and release behavior remain unchanged; explicit AOT and trim modes use a matching supported compiler
- [ ] #2 Both AOT modes pass the compiled product smoke on every supported native release target or identify concrete blockers
- [ ] #3 Compiler provenance, terminal dependency prerequisite and qualification limits are reviewable without publishing a release
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add explicit AOT and independent trim flags to the actual Tailwind build, rejecting unsupported flags, bundle-only output and a different embedded runtime. Reuse verified compiler preparation with all six native release hosts; preserve stable digests and TLS policy. A separate non-publishing CI workflow checks out exact no-node-pty source, applies BACK-794 preserved patch, builds the fork and stages its dist for qualification only. Run existing full compiled smoke in both modes and package launcher checks outside the checkout. Record native outcomes and unreleased dependency/terminal interaction gates. Existing smoke covers the known binary-data and asset failures; add no duplicate unit tests.

Extend the existing executable TLS bootstrap regression to the new workflow so experimental downloads preserve the repository trust policy; no new test layer.

Reuse all four existing interactive PTY suites against each compiled native artifact on POSIX via TUI_TEST_CLI_PATH and an empty TUI_TEST_CLI_RUNTIME. Provision expect explicitly and require it, so the gate cannot silently skip. This extends the user-required real terminal qualification without duplicating interaction assertions; preserve transcripts. Windows console interaction remains a separate gate.

Extend the compiled consumer qualification with a real Chromium interaction on Linux x64. Existing smoke verifies HTML/assets but never executes React. Using pinned Playwright1.62.1 outside product dependencies, open the board, create a task in the UI, edit its description, verify persisted CLI state, then edit its title through CLI and require the browser watcher to refresh. Retain screenshots and assert graceful browser-server SIGTERM exit0. This covers the user-required browser and native watching flows without changing UI behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented independent opt-in build flags and native qualification for all six release targets. Existing stable compiler/archive pins and TLS policy remain intact. Darwin x64 Buildkite133944 archive additionally downloaded and verified against published SHA1 and SHA256; extracted compiler SHA256 recorded. Local types and Biome pass after formatting; existing full compiled smoke passes AOT and AOT+trim with the exact BACK-794 patched dependency. New actual-artifact Node launcher layout smoke passes both modes (version/init/create/JSON list/nonzero failure). Existing launcher and packaging tests:21 pass; executable trust regression now covers the AOT workflow:4 pass. Workflow checks out exact no-node-pty head and applies preserved patch for qualification only; no npm dependency update/publication. Native CI pending. Latest Bun PR45631 merged 2026-10-27T23:50:42Z; official bun-pr downloaded head000968de8e5a99f0d171868c7d3e714c9700e4af from build134059, revision1.4.4-canary.1+000968de8, Linux SHA256c2c17501f6fe3d93333e55275a755de178d2ac83948ca49bcd965d65dc975115. Minimal Groma pm reproducer still fails untrimmed and keep-install with exit70; keep-cli passes. Backlog matrix remains on verified six-host d260 pin pending broader new-compiler qualification.

Native qualification run40607048907 on81aa510 passes full compiled smoke and actual-artifact Node launcher checks in BOTH AOT modes on all six existing release targets:Linux x64/arm64,macOS x64/arm64,Windows x64/arm64. Stable CI40607048685 compile smoke across release targets plus Windows/macOS unit profiles also pass; Linux full/Nix still running when recorded. Local default stable build+full compiled smoke pass; unsupported stable AOT/trim flags, bundle-only experimental output and mismatched runtime all reject correctly. Extending the native workflow to run the existing four POSIX PTY suites against artifacts; no source product behavior change. Full Windows console and browser interactions remain open.

All four existing real-PTY suites pass on the compiled AOT+trim Linux artifact:11 tests,53 assertions,47.40s. This exercises live task edits, removed-task neighbor selection, editor handoff twice, readiness initial render, all task ordering options and real xterm shift-arrow multi-move. Reused existing harness through artifact override; no test assertions changed. The native workflow now provisions expect explicitly and runs these suites on all four POSIX hosts in both modes; preserves transcripts. Windows console remains separate.

Native run40608007904 on1070bedb6c7f5405e2770989cab330f34df97519 passes all six targets in BOTH modes. Every POSIX host(Linux x64/arm64 andmacOS x64/arm64) additionally passes11 real-PTY tests/53assertions per mode, no skips. Windows x64/arm64 pass full compiled smoke and actual-artifact Node launcher. Browser interaction gate added for Linux x64 with pinned Playwright1.62.1; pending native run because scratch Chromium CDN download is unavailable(previous verified environment limitation). It checks actual React task creation/editing, CLI persistence, watcher refresh and SIGTERM0, retains screenshots. Types/Biome and existing executable-trust4tests pass; no UI product code changed. Windows actual console remains open; fork app write access/publication prerequisite unchanged.
<!-- SECTION:NOTES:END -->
