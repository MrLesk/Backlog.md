---
id: BACK-785
title: Upgrade dependencies and patch release tooling security
status: Done
assignee:
  - '@codex'
created_date: '2026-10-21T10:52:00Z'
updated_date: '2026-10-21T17:52:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1129
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
  - scripts/filter-trusted-cas.cjs
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
- [x] #3 CI, release, local runtime guidance, bun.lock, bun.nix, and flake inputs agree and have been validated.
- [x] #4 Required type, lint, test, compiled-binary, and Nix checks pass, with release-blocking upstream certificate fixes identified.
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
Updated dependencies, CI/release actions, Node/npm, and reproducible Bun/Nix inputs. The gray-matter patch retains js-yaml 4.3.2 to preserve opaque frontmatter and source metadata; Bun lock format 1 remains compatible with bun2nix. Runtime archives use patched Node and verified checksums. CI and Nix certificate bundles exclude the compromised CA keys. Bun 1.4.3 retains upstream CA and bundled Brotli limitations; see DEVELOPMENT.md for the scoped controls and remaining exposure.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refreshed dependencies and build tools, added verified runtime downloads and filtered certificate trust, and documented GitHub Release as the publishing entry point. Validated type/lint checks, CLI/browser behavior, native builds, and Nix packaging.
<!-- SECTION:FINAL_SUMMARY:END -->
