---
id: BACK-786
title: Protect native Git HTTPS fetches and Nix generator resolution
status: Done
assignee:
  - '@codex'
created_date: '2026-10-21T14:26:00Z'
updated_date: '2026-10-22T19:55:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1131'
  - package.json
  - .github/workflows/ci.yml
  - DEVELOPMENT.md
  - flake.nix
modified_files:
  - scripts/update-nix.cjs
  - package.json
  - biome.json
  - .github/workflows/ci.yml
  - DEVELOPMENT.md
  - bun.lock
  - bun.nix
  - scripts/filter-trusted-cas.cjs
  - src/git/certificate-trust.ts
  - src/git/operations.ts
  - src/test/fixtures/certificate-trust/README.md
  - src/test/fixtures/certificate-trust/compromised-cas.json
  - src/test/fixtures/certificate-trust/registry-ca.pem
  - src/test/fixtures/certificate-trust/registry-server.pem
  - src/test/fixtures/certificate-trust/registry-server-key.pem
  - src/test/fixtures/certificate-trust/incident-server-aaa.pem
  - src/test/fixtures/certificate-trust/incident-server-emudhra.pem
  - scripts/update-nix.test.cjs
  - src/test/git-certificate-trust.test.ts
  - scripts/run-ci-tests.ts
  - src/test/git.test.ts
  - src/test/fixtures/certificate-trust/unsupported-key-ca.pem
  - src/test/fixtures/certificate-trust/unsupported-key-server.pem
  - .github/workflows/release.yml
  - .github/workflows/architecture.yml
  - scripts/ci-trust.test.cjs
  - flake.nix
  - src/test/offline-mode.test.ts
  - src/test/fixtures/certificate-trust/trusted-registry-ca.pem
  - src/test/fixtures/certificate-trust/rejected-registry-ca.pem
  - src/test/fixtures/certificate-trust/trusted-compromised-cas.pem
priority: high
type: bug
ordinal: 396000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Protect native Git HTTP(S) fetches and Nix generator resolution from compromised certificate authorities while preserving explicit private CA settings and supported Git configuration. Refresh Biome and reproducible dependency artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The updater rejects unpatched Node and missing, unreadable, or empty CA files before package resolution; local bun2nix is used only after verifying version 2.1.2.
- [x] #2 Fallback resolution uses native npm under the same patched Node with explicit cafile and strict SSL, preserves native auth/proxy configuration, and no Nix generator path invokes bunx.
- [x] #3 CI and developer commands share the strict updater, Biome 2.6.2, and reproducible Bun/Nix dependency artifacts.
- [x] #4 Root package version changes remain controlled by the GitHub Release workflow.
- [x] #5 Supported HTTPS remote fetches preserve private Git trust while rejecting both incident certificate paths without changing SSH/local operations, timeout, or fetch coalescing.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Resolve the pinned Nix generator through patched Node/npm with strict certificate verification.
2. Isolate native Git fetch trust while preserving CA-file and CA-directory behavior.
3. Update dependency artifacts and CI integration, and validate supported platforms.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Native Git fetches use filtered system CAs by default and preserve explicit CA files and native CA-directory layouts. Background synchronization fetches parent repository refs without recursing into submodules. HTTPS proxies are unsupported; direct connections and ordinary HTTP proxies remain supported. Nix generator downloads use patched Node/npm, an explicit CA bundle, and a pinned generator version.

Validation: Linux, macOS and Windows tests, six binary builds and the Nix build passed on main. The architecture comparison passed before merge, and the main architecture deployment succeeded. Release v1.55.2 published all six platform packages and the main npm package; installation checks passed on Linux, macOS and Windows. The release workflow prepared and synced the root package version.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Released v1.55.2 with protected native Git HTTPS fetches, strict Nix generator resolution and refreshed build dependencies. Supported private CA settings and authentication are preserved. PR #1132 is merged and issue #1131 is closed. CI, architecture deployment and release installation checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
