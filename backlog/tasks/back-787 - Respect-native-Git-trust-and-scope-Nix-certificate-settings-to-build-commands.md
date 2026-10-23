---
id: BACK-787
title: Respect native Git trust and scope Nix certificate settings to build commands
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-23T06:33:00Z'
updated_date: '2026-10-23T06:39:00Z'
labels: []
dependencies: []
references:
  - src/git/operations.ts
  - src/git/certificate-trust.ts
  - flake.nix
  - DEVELOPMENT.md
  - 'https://github.com/MrLesk/Backlog.md/issues/1135'
modified_files:
  - src/test/git-certificate-trust.test.ts
  - src/git/operations.ts
  - src/git/certificate-trust.ts
  - flake.nix
  - .github/workflows/ci.yml
  - DEVELOPMENT.md
  - src/test/fixtures/certificate-trust/README.md
  - src/test/fixtures/certificate-trust/unsupported-key-ca.pem
  - src/test/fixtures/certificate-trust/unsupported-key-server.pem
  - src/test/fixtures/certificate-trust/trusted-compromised-cas.pem
  - scripts/filter-trusted-cas.cjs
priority: high
type: bug
ordinal: 397000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog currently replaces native Git certificate policy and rejects valid HTTPS proxies during task reads and ID allocation. Its Nix development shell also replaces Git/npm trust for unrelated commands. Restore ownership to the user environment while retaining protections for project-controlled builds and releases.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Runtime Git fetches inherit the user certificate, proxy and verification configuration without a Backlog certificate wrapper.
- [ ] #2 The Nix development shell does not override host Git/npm certificate configuration; project network build commands keep their explicit trust settings.
- [ ] #3 Existing non-interactive fetch behavior, timeout, coalescing and parent-only ref synchronization remain intact.
- [ ] #4 Focused regression checks and platform CI verify the supported Git and Nix flows.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the runtime certificate wrapper and its policy-specific tests; keep the existing native Git fetch command and lifecycle. 2. Scope filtered certificate settings to the explicit dependency-build commands instead of the entire Nix development shell; keep CI/release protections. 3. Cover the reproduced valid HTTPS proxy regression with an isolated test and verify existing fetch and Nix behavior. 4. Run checks, review scope and simplicity, and open the bottom PR of the requested GitHub stack.

Regression authority: Alex approved native Git ownership after the loopback probe showed a valid private HTTPS proxy accepted by Git and blocked by Backlog. Existing tests freeze the removed incident policy instead of user configuration. Replace that policy suite with a concurrent isolated real-Git HTTPS-proxy test and a small command-boundary test preserving existing fetch arguments and inherited options. Keep existing timeout/coalescing coverage.

Nix environment regression authority: the approved request requires the development shell to preserve user Git/npm trust. Existing Nix checks validate pinned tools and build trust, not inherited shell settings. Add one actual nix develop command in CI comparing inherited Git and npm CA paths; the old shell overrides both paths and must fail this check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The private HTTPS proxy regression fails before the fix (zero requests) and passes after it. Removed the runtime certificate wrapper and its incident-policy suite; kept native fetch arguments, timeouts and coalescing. Nix development shell no longer exports trust overrides; build checks and CI retain their scoped trust. Types, Biome and 27 focused Git tests pass. Architecture responsibility remains with the existing external Git element; no new OKF/C4 concept or stored metadata is needed.

Focused Git/offline verification: 33 tests pass. The first build-security run used npm older than CI requires and stopped at its existing npm version guard; rerunning with temporary npm12.2.0 and Node26.12.1. Full CI test profile started against the bundled CLI. Nix is not installed locally, so the actual shell and package checks will run in GitHub CI.
<!-- SECTION:NOTES:END -->
