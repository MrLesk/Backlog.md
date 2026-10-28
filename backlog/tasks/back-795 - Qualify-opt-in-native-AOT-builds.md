---
id: BACK-795
title: Qualify opt-in native AOT builds
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-28T00:07:00Z'
updated_date: '2026-10-28T01:14:00Z'
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
  - scripts/prepare-console-driver.cjs
  - scripts/smoke-console-build.ts
  - .github/workflows/release.yml
ordinal: 403000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Native AOT currently requires a scratch wrapper and a manually patched terminal dependency. Establish repeatable native build and smoke qualification for the existing six release targets while keeping stable releases unchanged and the unpublished Blessed prerequisite explicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Default build and release behavior remain unchanged; explicit AOT and trim modes use a matching supported compiler
- [x] #2 Both AOT modes pass the compiled product smoke on every supported native release target or identify concrete blockers
- [x] #3 Compiler provenance, terminal dependency prerequisite and qualification limits are reviewable without publishing a release
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add explicit AOT and independent trim flags to the actual Tailwind build, rejecting unsupported flags, bundle-only output and a different embedded runtime. Reuse verified compiler preparation with all six native release hosts; preserve stable digests and TLS policy. A separate non-publishing CI workflow checks out exact no-node-pty source, applies BACK-794 preserved patch, builds the fork and stages its dist for qualification only. Run existing full compiled smoke in both modes and package launcher checks outside the checkout. Record native outcomes and unreleased dependency/terminal interaction gates. Existing smoke covers the known binary-data and asset failures; add no duplicate unit tests.

Extend the existing executable TLS bootstrap regression to the new workflow so experimental downloads preserve the repository trust policy; no new test layer.

Reuse all four existing interactive PTY suites against each compiled native artifact on POSIX via TUI_TEST_CLI_PATH and an empty TUI_TEST_CLI_RUNTIME. Provision expect explicitly and require it, so the gate cannot silently skip. This extends the user-required real terminal qualification without duplicating interaction assertions; preserve transcripts. Windows console interaction remains a separate gate.

Extend the compiled consumer qualification with a real Chromium interaction on Linux x64. Existing smoke verifies HTML/assets but never executes React. Using pinned Playwright1.62.1 outside product dependencies, open the board, create a task in the UI, edit its description, verify persisted CLI state, then edit its title through CLI and require the browser watcher to refresh. Retain screenshots and assert graceful browser-server SIGTERM exit0. This covers the user-required browser and native watching flows without changing UI behavior.

Use the same verified tui-test0.1.1 Windows console driver proven by the Groma native setup for Windows x64 and ARM64 Backlog artifacts. Reuse patched-Node downloading and archive digest validation, with x64 driver emulation on ARM documented. Exercise board task selection/Enter details/Escape/q, then restart and send actual Ctrl+C; assert actual PTY process exit0 for both sessions and retain screenshots. This closes the explicitly open Windows console gate without adding a shipped node-pty dependency.

Prepare release opt-in wiring with explicit AOT=0 and TRIM=0 defaults. Use the already-qualified six native runners and select the verified experimental pin only when reviewed flags are enabled. Gate artifact upload on existing full compiled smoke and actual-artifact Node launcher smoke. Preserve prepared tag/commit/version, TLS and publication jobs; do not dispatch a release.

Validate the release runner change with an unpatched stable build and the exact pre-upload product/launcher smoke on every native host, before staging the Blessed qualification patch. This reuses existing checks and proves the default release path can execute natively on the new runners.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented independent opt-in build flags and native qualification for all six release targets. Existing stable compiler/archive pins and TLS policy remain intact. Darwin x64 Buildkite133944 archive additionally downloaded and verified against published SHA1 and SHA256; extracted compiler SHA256 recorded. Local types and Biome pass after formatting; existing full compiled smoke passes AOT and AOT+trim with the exact BACK-794 patched dependency. New actual-artifact Node launcher layout smoke passes both modes (version/init/create/JSON list/nonzero failure). Existing launcher and packaging tests:21 pass; executable trust regression now covers the AOT workflow:4 pass. Workflow checks out exact no-node-pty head and applies preserved patch for qualification only; no npm dependency update/publication. Native CI pending. Latest Bun PR45631 merged 2026-10-27T23:50:42Z; official bun-pr downloaded head000968de8e5a99f0d171868c7d3e714c9700e4af from build134059, revision1.4.4-canary.1+000968de8, Linux SHA256c2c17501f6fe3d93333e55275a755de178d2ac83948ca49bcd965d65dc975115. Minimal Groma pm reproducer still fails untrimmed and keep-install with exit70; keep-cli passes. Backlog matrix remains on verified six-host d260 pin pending broader new-compiler qualification.

Native qualification run40607048907 on81aa510 passes full compiled smoke and actual-artifact Node launcher checks in BOTH AOT modes on all six existing release targets:Linux x64/arm64,macOS x64/arm64,Windows x64/arm64. Stable CI40607048685 compile smoke across release targets plus Windows/macOS unit profiles also pass; Linux full/Nix still running when recorded. Local default stable build+full compiled smoke pass; unsupported stable AOT/trim flags, bundle-only experimental output and mismatched runtime all reject correctly. Extending the native workflow to run the existing four POSIX PTY suites against artifacts; no source product behavior change. Full Windows console and browser interactions remain open.

All four existing real-PTY suites pass on the compiled AOT+trim Linux artifact:11 tests,53 assertions,47.40s. This exercises live task edits, removed-task neighbor selection, editor handoff twice, readiness initial render, all task ordering options and real xterm shift-arrow multi-move. Reused existing harness through artifact override; no test assertions changed. The native workflow now provisions expect explicitly and runs these suites on all four POSIX hosts in both modes; preserves transcripts. Windows console remains separate.

Native run40608007904 on1070bedb6c7f5405e2770989cab330f34df97519 passes all six targets in BOTH modes. Every POSIX host(Linux x64/arm64 andmacOS x64/arm64) additionally passes11 real-PTY tests/53assertions per mode, no skips. Windows x64/arm64 pass full compiled smoke and actual-artifact Node launcher. Browser interaction gate added for Linux x64 with pinned Playwright1.62.1; pending native run because scratch Chromium CDN download is unavailable(previous verified environment limitation). It checks actual React task creation/editing, CLI persistence, watcher refresh and SIGTERM0, retains screenshots. Types/Biome and existing executable-trust4tests pass; no UI product code changed. Windows actual console remains open; fork app write access/publication prerequisite unchanged.

First Chromium run40609233416 renders the actual board and performs create/open/edit/save, then the harness queries edited text while the asynchronous save is still in editor mode: Playwright strict locator finds the editor textarea and its code mirror. Correct by awaiting the preview-mode Edit button before asserting visible saved content; retain exact CLI persistence, watch refresh, JavaScript errors and shutdown assertions. This is a consumer-test synchronization correction, not a demonstrated product failure.

Added native Windows console gate using pinned verified tui-test0.1.1. It checks board ordering through actual second-row Down/Enter details, Escape/q, fresh restart and real Ctrl+C; requires PTY process exit0, captures SVGs. Windows ARM64 uses the x64 driver under emulation, product remains native ARM64. Reused existing patched-Node download/guard functions rather than introducing another HTTPS implementation. Local types/Biome and executable-trust4tests pass; Windows interaction itself requires native CI. No shipped node-pty dependency added.

Native run40610164262 on3f7c5f passes all six targets in both AOT modes, including Windows x64/ARM64 actual board selection/details/Escape/q and Ctrl+C with PTY exit0. All POSIX hosts pass11tests/53assertions per mode. Linux x64 Chromium create/edit/persistence/watch/SIGTERM0 passes; downloaded artifact12782277408, verified ZIP SHA256d572cc72ae7cd935d8033e7cc55c611515ccd68505173eb87bd6115909aed92e and visually reviewed board/edit PNGs. Regular CI40610164374 is fully green including Nix. QEMU IvyBridge(no AVX2) negative control official Bun1.3.13 exitsSIGILL while both Backlog AOT modes perform task CRUD; Groma trimmed/untrimmed plain-map checks also pass. Release prep now uses six native runners, explicit mode defaults0 and pre-upload compiled+Node launcher gates; TLS trust4tests, YAML/default-mode/shell validation and local stable product+launcher gates pass. Native qualification additionally checks an unpatched stable artifact before the Blessed patch, proving the default release path on each runner. No release dispatched; Blessed fork403/npm publication prerequisite remains.

Final release-wiring native run40612890192 on d997c8f6554d8539b3cce94aef49f993bf52d53e passes all6 hosts: the unpatched stable default product+Node launcher gates pass first, then both patched-dependency AOT modes pass all compiled/PTY/browser/Windows console gates. Local final types/Biome and executable trust4tests pass. This qualifies release build preparation while flags remain0; it does not replace the approved published Blessed dependency prerequisite. Final PR remains draft and task stays In Progress while that shipping prerequisite is external.
<!-- SECTION:NOTES:END -->
