---
id: BACK-789
title: Upgrade Bun to 1.4.4 and refresh build tool patches
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-23T15:35:00Z'
updated_date: '2026-10-23T15:42:00Z'
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
- [ ] #1 Native and Nix builds use official checksum-verified Bun 1.4.4 archives for all supported targets, with matching Bun type definitions and reproducible dependency caches.
- [ ] #2 CI, release and Nix development tooling use the latest released npm patch; remaining upstream advisories and the project-owned tool boundary are documented accurately.
- [ ] #3 Task persistence, browser, MCP, old-CPU Nix checks and Windows/Linux/macOS CI pass with the updated runtime.
- [ ] #4 One hotfix is prepared with the two reviewed PRs and the runtime/tool update, using the established release-note format and no additional prerelease or manual package version bump.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify official runtime archive digests and current stable tool patches; preserve existing Git trust and build ownership. 2. Update Bun platform pins, npm pins, Bun types, lock/cache files and accurate development guidance. Existing packaged smoke tests cover the user-visible task/browser/MCP flow; existing trust tests cover owned build downloads. No new behavior or duplicate tests are needed for pin changes. 3. Run type/lint, build-tool trust checks and a native build/smoke, then complete Windows/Linux/macOS and Nix CI on the stack. 4. Review the changed flow, finalize the task, and prepare one hotfix from the green merged stack with concise user-facing notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated all six official Bun archive pins and three Nix runtime sources to1.4.4, npm CI/release/Nix pins to12.2.1 and matching Bun types/cache files. Type checking, Biome and all seven existing build-tool/workflow trust tests pass. No new tests are needed: the existing installed-package and old-CPU checks exercise the runtime update and preserve task persistence.

The Tailwind build plugin also resolves Bun as a peer package. Refreshed that existing lockfile entry and all its platform packages to1.4.4 without adding a root dependency or override, then regenerated bun.nix. This prevents the build cache from retaining an affected runtime.

The verified downloader fetched the official1.4.4 host archive and the fresh native executable passed task persistence, write-failure, browser and MCP smoke checks. The first44-test focused run had one500ms Git fixture timeout before child.pid existed while the native compiler ran concurrently. That test passed alone, and the identical complete44-test suite passed after compilation finished. No test, assertion, timeout or production Git code was changed; platform CI remains the release gate.
<!-- SECTION:NOTES:END -->
