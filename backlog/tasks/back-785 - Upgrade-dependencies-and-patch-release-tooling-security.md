---
id: BACK-785
title: Upgrade dependencies and patch release tooling security
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-21T10:52:00Z'
updated_date: '2026-10-21T11:35:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1129'
modified_files:
  - package.json
  - bun.lock
  - patches/gray-matter@4.0.3.patch
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .github/workflows/architecture.yml
  - DEVELOPMENT.md
  - src/test/cli-timestamps.test.ts
  - flake.lock
  - scripts/prepare-bun-runtime.cjs
  - scripts/build.ts
  - bun.nix
  - flake.nix
  - src/test/tui-task-composer.test.ts
  - AGENTS.md
priority: high
type: chore
ordinal: 395000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The October 2026 certificate-authority incident and dependency advisories expose runtime trust and outdated build inputs. Refresh the complete dependency graph and release tooling, preserve the documented CLI/browser behavior, and regenerate reproducible Nix inputs before a hotfix release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All direct dependencies and CI actions are checked against their latest stable releases, upgraded where applicable, and remaining exceptions are documented.
- [x] #2 Known dependency advisories are removed or have a verified explanation and scoped mitigation.
- [ ] #3 CI, release, local runtime guidance, bun.lock, bun.nix, and flake inputs agree and have been validated.
- [ ] #4 Required type, lint, test, compiled-binary, and Nix checks pass, with release-blocking upstream certificate fixes identified.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit registry latest versions, transitive advisories, CI actions, and runtime/Nix inputs. 2. Upgrade dependency graph and tooling, adapt breaking APIs, and address certificate trust with the verified upstream runtime or a scoped mitigation. 3. Regenerate Bun/Nix lock artifacts and validate supported behavior and packaged binaries. 4. Open one PR with objective checks and remaining release blockers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audited every direct registry latest tag and refreshed all direct and in-range transitive dependencies. Latest Mermaid12.2 adopts KaTeX0.18 and removes that advisory. Remaining sprintf-js comes from gray-matter4.0.3 through js-yaml3; evaluating a narrow dependency patch to current js-yaml5 rather than leaving the advisory in the graph.

js-yaml5.5.0 was evaluated and rejected for this hotfix: three existing tests detect lost opaque timestamp semantics and preserved metadata, its listener API is removed, and collection-end source positions are absent from its replacement event API. Patched gray-matter to load/dump and selected current4.x4.3.2, which removes the vulnerable sprintf-js chain while retaining listener-based source preservation. The timestamp test now checks raw YAML scalar type and value instead of the dumper choosing a particular quote spelling.

Upgraded every direct package with a newer stable release and refreshed all compatible transitive resolutions (570 lock entries / 531 package names checked). bun audit returns an empty advisory result. Nix flake inputs updated to the current unstable snapshot; bun.nix regenerated with bun2nix2.1.2. Retained updater-preserved lock format1 because bun2nix2.1.2 rejects Bun format2. Removed the duplicate older Nix Biome; project commands use locked Biome2.6.1.

All workflow action refs use current stable releases. Every job starts with offline filtering of all12 incident SPKIs, including ancestor trust keys, before network steps; Node actions use OpenSSL trust with the filtered bundle. Git also receives an empty GIT_SSL_CAPATH. Bun PM always gets explicit --cafile. Host and six target Bun archives are downloaded through patched Node26.12.1, SHA256 verified and extracted; compile.executablePath bypasses Bun native HTTPS. Cross-target builds now require that path. Node/npm workflow versions are26.12.1/12.2.0. Architecture temporarily pins action1.2.1 SHA and prewarms Node24.22.1 to satisfy its cached24 selection; Groma0.7.2 exports committed comparisons without scanner installation pending the coordinated upstream hotfix.

Verified: type/lint checks, frozen install, native compile and complete binary/browser smoke, Nix package build with native/browser smoke and QEMU IvyBridge positive and AVX2 negative controls. Exact bootstrap rejects all12 public incident chains under OpenSSL. Downloader accepts the official verified ZIP and rejects single-byte corruption before extraction. The sandbox proxy times out on its real HTTPS tunnel, so hosted CI must verify live asset downloads. Initial full suite had one harmless YAML escape-spelling expectation (now asserts the same parsed scalar) and one environment-only PTY failure under TERM=dumb; that unchanged test passes under TERM=xterm, and final full suite is rerunning with that terminal setting.

Bun1.4.3 remains the latest stable but still has upstream CA trust and bundled Brotli exposure. The explicit CA mitigation covers package requests; checksum verification and patched Node cover runtime downloads. It does not claim Bun itself is patched. Backlog has no external HTTPS requests, while package installation retains the upstream Brotli risk. Initial hosted-runner action preparation trust remains the runner vendor responsibility.

Final full isolated suite with TERM=xterm passed: behavioral3201 pass/13 skip/0 fail across283 files; DOM399 pass/0 fail across39 files. The final cross-target build using the helper-extracted runtime and complete native CLI/browser smoke also passed. Frozen install, types, regenerated bun.nix comparison and audit{} passed. Nix package was actually built with native/browser and QEMU checks; the Node26.12.1 development shell derivation/version was evaluated, not source-built.

Hosted CI proved live verified runtime downloads on Linux/macOS and Windows host installation, with Linux compile/smoke/compiled-TUI passing. It exposed a broken upstream Biome2.6.x publication: wrapper2.6.1 exists but cli-linux-x642.6.1 and2.6.0 both return404 from registry.npmjs.org, while2.5.15 returns200. Local installation had reused the older native binary. Pinned the complete installable2.5.15 release, regenerated both lock artifacts, and reran actual native lint/types/audit successfully. This is an explicit availability exception to latest stable; final hosted matrix remains required.

Extended the CI compile matrix to all six release targets so every verified archive digest and compile.executablePath target is exercised before publication; native binary smoke stays on the three matching runner targets. Final local Nix rebuild with the complete Biome2.5.15 locks passed all install and QEMU checks.

Replaced source-only Nix Node override after inspecting Nixpkgs shared-library linkage: it would retain older system Brotli/c-ares instead of the Node release fixes. The shell now packages the three official Node26.12.1 archives with published SHA256 digests and npm12.2.0 with official registry integrity, using autoPatchelf on Linux. Patched shell curl/Git use the authoritative Brotli CVE-2026-111497 commit through a bounded override, avoiding a940-derivation global overlay. Added a flake development-tools check to realize/test these actual runtimes independently of bun2nix. Local complete shell realization hit disk capacity while fetching unrelated Rust dependencies; hosted CI must prove this bounded check. No further global rebuild or manual Nix database edits were attempted.

Recorded the maintainer release sequence in AGENTS.md per explicit user direction: after reviewed merge and passing checks, publish a GitHub Release with vMAJOR.MINOR.PATCH; its workflow automatically prepares tagged source and bumps package.json. Do not manually bump the root version or initiate release via a raw tag push.
<!-- SECTION:NOTES:END -->
