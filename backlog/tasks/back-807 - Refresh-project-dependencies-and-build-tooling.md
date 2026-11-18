---
id: BACK-807
title: Refresh project dependencies and build tooling
status: Done
assignee:
  - '@codex'
created_date: '2026-11-18T22:35:00Z'
updated_date: '2026-11-18T22:52:00Z'
labels: []
dependencies: []
references:
  - package.json
  - flake.nix
  - .github/workflows/ci.yml
  - groma/config.json
  - https://github.com/MrLesk/Backlog.md/pull/1221
modified_files:
  - package.json
  - bun.lock
  - biome.json
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .github/workflows/architecture.yml
  - flake.nix
  - DEVELOPMENT.md
  - bun.nix
  - flake.lock
  - groma/config.json
type: chore
ordinal: 409000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review the versions used to build and test the shipped CLI, browser and npm packages against current stable upstream releases. Native builds and Nix must retain the same verified runtime and task-file behavior as developers and CI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Direct project packages, Bun and build tools are checked against stable upstream releases, with evidence for any version kept behind latest.
- [x] #2 CI, release, Nix and local development inputs agree on their tool versions and verified artifacts, and both dependency caches can be regenerated.
- [x] #3 The supported CLI, browser, MCP, native executables and npm packaging retain their behavior on the updated tools, including the existing trust and older-CPU checks.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Compare each direct dependency and CI or Nix runtime pin with its official stable release. Verify migration notes and source-preserving Markdown behavior for major changes.
2. Update compatible versions and hashes, generate the Bun and Nix caches, and align developer guidance with the shipped settings. Leave any incompatible version at the latest compatible release and record the evidence.
3. Run frozen installation, type and lint checks, focused Markdown and browser coverage, full CI tests, native and npm package smoke tests, and Nix checks. Open the task PR and follow its CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compared all root development packages and repository-owned workflow actions with their published stable versions. Twelve existing packages moved forward, including jsdom 31.0.1. Bun’s runtime, peer and types already match stable 1.4.4. All six official runtime archive digests match. Node 26.13.1 is the latest stable release. Node 27 is alpha. The first lock refresh resolved Bun’s wildcard Node types to the Node 16 declarations used by image-q. The type checker then reported 37 errors. Making the Node 26.6.6 typings a direct development dependency fixed the project and allowed image-q to retain its own version.

The Markdown parser stays at js-yaml 4.3.2, the latest v4 release. In a header with a date and an anchored mapping merged into another field, v4 reports 22 source events, a Date and the merged value. Version 5.5.0 reports no events, a string and no merged value. Backlog uses the removed listener API to retain date spelling and unknown frontmatter. [Upstream migration guide](https://github.com/nodeca/js-yaml/blob/5.5.0/docs/migrate_v4_to_v5.md)

The updated Nixpkgs ships Brotli 1.2.1, so its Git and curl include the exact fix previously patched in this flake. The separately pinned old AVX2-only executable remains the control for checking older-CPU support. The Nixpkgs default Bun archive for x64 differs from the unified archive Backlog ships. [Pinned Brotli package](https://github.com/NixOS/nixpkgs/blob/04906337b6d53e8bb0eaf0470ae9f070a4d4eb55/pkgs/by-name/br/brotli/package.nix) · [Upstream patch in 1.2.1](https://github.com/google/brotli/commit/b418fa81c48262a86a95332b0bc6d62c30aa78b6)

The registry audit went from nine findings on the base lock to one. Eight were resolved in Hono, its Node adapter and body-parser. The remaining advisory affects the copy of Zod 3.25.76 installed through neo-neo-bblessed 1.0.10, Jimp 1.6.1 and its plugins. No patched v3 release exists. The production bundle metadata contains no Jimp or Zod 3 modules in its 1,378 inputs. MCP uses the patched Zod 4.6.7. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

The current Groma action uses its own Node 26.12.1 and npm 12.2.1, including that npm version’s older ip-address and Undici. The action exposes no input for those tools. Backlog’s CI, release and Nix pins select 26.13.1 and 12.2.3. Groma’s own Backlog 1.54.0 setting is a minimum for the work-source adapter. [Action Node pin](https://github.com/MrLesk/groma.md-action/blob/v1.2.4/action.yml#L59) · [Action npm pin](https://github.com/MrLesk/groma.md-action/blob/v1.2.4/prepare-trust.mjs#L29)

The cold review verified the official Bun and Node archive digests and matching versions and integrity hashes for all 545 unique packages in bun.lock and bun.nix. Its finding added the updated React and TypeScript scanner pins using Groma. The final review confirmed the compatibility evidence and the upstream action boundary.

The frozen isolated install, all 565 checked TypeScript files, Biome, seven build-trust tests and deterministic bun.nix generation passed. The packaged macOS ARM64 CLI passed its task-persistence, failed-write, browser and MCP smoke. Both npm tarballs installed together offline. Chrome edited and saved a description through the packaged Markdown editor, and the CLI read it back. The interactive TUI suites passed 11 source and six compiled checks. A Linux ARM64 Nix package and development shell passed the package smoke, pinned tool and inherited trust checks. The published Groma 0.7.8 scanned and exported clean checkouts on macOS and Linux with the two current scanners.

CI on the implementation commit passed all six native build targets, Linux, macOS, Windows and x86-64 Nix, including the independent old-CPU control and the development-shell trust checks. The two Linux test passes totalled 3,787 passed, 13 skipped and zero failed. CodeQL and the architecture workflow also passed. [Implementation CI](https://github.com/MrLesk/Backlog.md/actions/runs/44414628000)

The local full test initially inherited TERM=dumb. One interactive assertion lost the cursor movement used for word spacing. The same fixture failed identically on the unchanged base and passed with TERM=xterm-256color.
The complete local rerun with that terminal type passed 3,787 tests, with the same 13 skips as Linux CI and zero failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated twelve direct packages, pinned the project’s Node type definitions, and refreshed CI, release, Groma and Nix dependencies. Bun 1.4.4 was already current. Kept the compatible Markdown parser and documented the single remaining install-graph advisory and the external Groma action’s tool pins. The full Linux and macOS test runs, six cross-platform builds, package and browser smoke checks, interactive TUI, Linux ARM64 and x86-64 Nix, CodeQL and both reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
