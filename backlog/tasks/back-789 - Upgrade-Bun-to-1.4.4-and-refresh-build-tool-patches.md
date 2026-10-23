---
id: BACK-789
title: Upgrade Bun to 1.4.4 and refresh build tool patches
status: Done
assignee:
  - '@codex'
created_date: '2026-10-23T15:35:00Z'
updated_date: '2026-10-23T16:00:00Z'
labels: []
dependencies:
  - BACK-788
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1139'
  - scripts/prepare-bun-runtime.cjs
  - flake.nix
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - package.json
  - DEVELOPMENT.md
modified_files:
  - scripts/prepare-bun-runtime.cjs
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - flake.nix
  - package.json
  - scripts/update-nix.cjs
  - DEVELOPMENT.md
  - bun.lock
  - bun.nix
priority: high
type: chore
ordinal: 399000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bun 1.4.4 now fixes the embedded Brotli decoder and compromised certificate trust left pending by the previous security hotfix. Native Backlog executables and Nix packages must receive that patched runtime. Refresh available released build-tool patches without changing users Git/npm configuration or introducing new runtime requirements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Native and Nix builds use official checksum-verified Bun 1.4.4 archives for all supported targets, with matching Bun type definitions and reproducible dependency caches.
- [x] #2 CI, release and Nix development tooling use the latest released npm patch; remaining upstream advisories and the project-owned tool boundary are documented accurately.
- [x] #3 Task persistence, browser, MCP, old-CPU Nix checks and Windows/Linux/macOS CI pass with the updated runtime.
- [x] #4 One hotfix is prepared with the two reviewed PRs and the runtime/tool update, using the established release-note format and no additional prerelease or manual package version bump.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify official runtime archive digests and current stable tool patches; preserve existing Git trust and build ownership. 2. Update Bun platform pins, npm pins, Bun types, lock/cache files and accurate development guidance. Existing packaged smoke tests cover the user-visible task/browser/MCP flow; existing trust tests cover owned build downloads. No new behavior or duplicate tests are needed for pin changes. 3. Run type/lint, build-tool trust checks and a native build/smoke, then complete Windows/Linux/macOS and Nix CI on the stack. 4. Review the changed flow, finalize the task, and prepare one hotfix from the green merged stack with concise user-facing notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated all six verified native Bun archives and three Nix runtime sources to 1.4.4, npm CI/release/Nix pins to 12.2.1, matching Bun types, the existing Tailwind Bun peer, and both dependency caches. No root dependency or override was added. Node stays at 26.12.1; user Git/npm settings and launcher requirements are unchanged.

Verification: types and Biome pass, seven build-tool/workflow trust tests pass, the updated downloader verifies the official host archive, and a fresh native executable passes task persistence, failed-write, browser and MCP smoke checks. The identical complete focused suite passes 44 tests. Its first run during concurrent native compilation missed a fixture PID file before a 500 ms timeout; that same test passes alone and in full Linux CI, with assertions and timeouts unchanged.

Code CI passed at 9bbc305: https://github.com/MrLesk/Backlog.md/actions/runs/39980617495 . Windows/Linux/macOS tests, six native targets, actual Nix package and old-CPU checks, Node/npm development tools, and inherited Git/npm CA preservation all passed. Linux reports 3,602 passed, 13 skipped and zero failed. Architecture and CodeQL also passed. The independent final reviewer verified official archive/integrity values, matching peer/type/cache versions and the runtime security fixes, with no blocker or material simplification found.

Specification and quality reviews: accepted runtime and tool pins, shared package smoke coverage, trust ownership and public launcher behavior match the task. The existing downloader owns platform runtime verification; CI and Nix consume the same release. No new behavior, abstraction or test was introduced. npm 12.2.1 still has upstream ip-address and Undici advisories, documented in DEVELOPMENT.md; npm is build tooling and is not embedded in the native CLI.

Prepared one v1.55.3 hotfix with these notes, following the recent short hotfix format. The merged stack is the publication target; no prerelease or manual package version bump is used.

- Restore native Git certificate and proxy settings, including support for private HTTPS proxies.
- Fix task reads and writes in Nix packages.
- Rebuild native executables and Nix packages with Bun 1.4.4 to include the upstream Brotli decoder and certificate trust fixes, and update build tools.

Changes: https://github.com/MrLesk/Backlog.md/pull/1136, https://github.com/MrLesk/Backlog.md/pull/1137, https://github.com/MrLesk/Backlog.md/pull/1140
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Upgraded native and Nix runtimes to Bun 1.4.4 for the upstream Brotli and certificate-trust fixes, and updated available npm build-tool patches to 12.2.1. Verified matching archive hashes, types, peer runtime and dependency caches. Windows, Linux, macOS, six native targets and actual Nix CI passed, as did the independent review. Remaining upstream npm advisories are documented. Prepared v1.55.3 notes combining this update with the reviewed native-Git trust and Nix persistence fixes.
<!-- SECTION:FINAL_SUMMARY:END -->
