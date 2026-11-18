---
id: BACK-807
title: Refresh project dependencies and build tooling
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-18T22:35:00Z'
updated_date: '2026-11-18T22:45:00Z'
labels: []
dependencies: []
references:
  - package.json
  - flake.nix
  - .github/workflows/ci.yml
  - groma/config.json
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
- [ ] #3 The supported CLI, browser, MCP, native executables and npm packaging retain their behavior on the updated tools, including the existing trust and older-CPU checks.
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
Bun 1.4.4 and its types are already stable latest. All six embedded runtime SHA-256 digests agree with the official release. Node 26.13.1 is the latest stable release. Node 27 is alpha. Keep js-yaml 4.3.2, the latest v4 patch. For a header with a date and an anchored mapping merged into another key, v4 produced a Date, a merged value, and 22 listener events. With 5.5.0, the same call produced a string, no merged value and zero events. Backlog uses these events to retain original date spelling and unknown Markdown metadata. Version 5 removed the listener API and changed its default schema. A migration needs a separate change to the parser. See https://github.com/nodeca/js-yaml/blob/5.5.0/docs/migrate_v4_to_v5.md.

Nix updated nixos-unstable to 04906337b6d53e8bb0eaf0470ae9f070a4d4eb55, where the Brotli package uses release 1.2.1: https://github.com/NixOS/nixpkgs/blob/04906337b6d53e8bb0eaf0470ae9f070a4d4eb55/pkgs/by-name/br/brotli/package.nix . That release includes the same security patch formerly applied locally, as shown by the upstream cherry-pick: https://github.com/google/brotli/commit/b418fa81c48262a86a95332b0bc6d62c30aa78b6 . Git and curl can now use Nixpkgs directly. Bun and the archived AVX2-only executable remain separately checksum-pinned for the older-CPU control. An unpinned transitive Node types dependency initially resolved to 16.9.1 and caused 37 type errors on Node APIs. Pinning the current 26.6.6 declarations directly fixed them while allowing image-q to keep its own older declaration dependency.

The install graph retains Zod 3.25.76 because the current Jimp 1.6.1 plugins require ^3.23.8. No patched release exists in that range for GHSA-mrhx-c7xc-m3w5. Bun build metadata for all 1,378 CLI/browser inputs shows no Jimp or Zod 3 modules and confirms the MCP adapter uses patched Zod 4.6.7. Documented the single remaining audit advisory in DEVELOPMENT.md.

An independent audit of the unmodified base lock at 2dd9160a reported nine advisories. Eight are resolved by the upgrade (Hono, its Node adapter and body-parser). The same Zod advisory was already present via neo-neo-bblessed 1.0.10 → jimp 1.6.1 → @jimp plugins → Zod 3.25.76. The affected copy is installed in development dependencies, separate from the bundled MCP copy.

Groma and its action are the latest releases, and the project scanners now use React 0.2.3 and TypeScript 0.2.4. The work-source entry is a minimum supported Backlog version. The external action itself hard-codes Node 26.12.1 and npm 12.2.1 without exposing a version input. Its map-generation job still has the older npm dependency advisories. The CI, release and Nix tool pins controlled by this repository use 26.13.1 and 12.2.3. See https://github.com/MrLesk/groma.md-action/blob/v1.2.4/action.yml and https://github.com/MrLesk/groma.md-action/blob/v1.2.4/prepare-trust.mjs.

Local checks passed for frozen installation, 565 type-checked files, Biome, 104 focused tests, seven build-trust tests, native packaged CLI/browser/MCP smoke, and both npm tarballs installed together offline. Headless Chrome opened the compiled browser, edited a description using the Markdown editor and saved the result, which the packaged CLI then read. A Linux ARM64 Nix build ran the package install checks and confirmed Node 26.13.1, npm 12.2.3 and curl linked to Brotli 1.2.1. Regenerating bun.nix produced the same bytes. Full-platform CI will check the other release targets and the older-CPU control. The cold review found the scanner pins and verified native hashes and lock agreement. Both scanner pins were updated with Groma and confirmed in the separate final review.
<!-- SECTION:NOTES:END -->
