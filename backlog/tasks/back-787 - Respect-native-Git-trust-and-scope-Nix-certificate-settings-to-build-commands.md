---
id: BACK-787
title: Respect native Git trust and scope Nix certificate settings to build commands
status: Done
assignee:
  - '@codex'
created_date: '2026-10-23T06:33:00Z'
updated_date: '2026-10-23T07:17:00Z'
labels: []
dependencies: []
references:
  - src/git/operations.ts
  - src/git/certificate-trust.ts
  - flake.nix
  - DEVELOPMENT.md
  - 'https://github.com/MrLesk/Backlog.md/issues/1135'
  - src/test/id-generation.test.ts
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
  - src/test/id-generation.test.ts
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
- [x] #1 Runtime Git fetches inherit the user certificate, proxy and verification configuration without a Backlog certificate wrapper.
- [x] #2 The Nix development shell does not override host Git/npm certificate configuration; project network build commands keep their explicit trust settings.
- [x] #3 Existing non-interactive fetch behavior, timeout, coalescing and parent-only ref synchronization remain intact.
- [x] #4 Focused regression checks and platform CI verify the supported Git and Nix flows.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the runtime certificate wrapper and its policy-specific tests; keep the existing native Git fetch command and lifecycle. 2. Scope filtered certificate settings to the explicit dependency-build commands instead of the entire Nix development shell; keep CI/release protections. 3. Cover the reproduced valid HTTPS proxy regression with an isolated test and verify existing fetch and Nix behavior. 4. Run checks, review scope and simplicity, and open the bottom PR of the requested GitHub stack.

Regression authority: Alex approved native Git ownership after the loopback probe showed a valid private HTTPS proxy accepted by Git and blocked by Backlog. Existing tests freeze the removed incident policy instead of user configuration. Replace that policy suite with a concurrent isolated real-Git HTTPS-proxy test and a small command-boundary test preserving existing fetch arguments and inherited options. Keep existing timeout/coalescing coverage.

Nix environment regression authority: the approved request requires the development shell to preserve user Git/npm trust. Existing Nix checks validate pinned tools and build trust, not inherited shell settings. Add one actual nix develop command in CI comparing inherited Git and npm CA paths; the old shell overrides both paths and must fail this check.

Windows verification found two fixture timeouts at the unchanged 10-second limit. Keep the full proxy request/status assertions but write its owned Git fixture configuration directly after git init instead of launching three config processes. The archive-ID suite describes a project outside Git but uses the helper that initializes Git; use initializeFilesystemTestProject for that declared local-filesystem scenario, retaining every archive/ID assertion. Existing Git and worktree suites retain Git-aware allocation coverage. Do not change timeouts, assertions, worker limits or retry policies.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The private HTTPS proxy regression fails before the fix (zero requests) and passes after it. Removed the runtime certificate wrapper and its incident-policy suite; kept native fetch arguments, timeouts and coalescing. Nix development shell no longer exports trust overrides; build checks and CI retain their scoped trust. Types, Biome and 27 focused Git tests pass. Architecture responsibility remains with the existing external Git element; no new OKF/C4 concept or stored metadata is needed.

Focused Git/offline verification: 33 tests pass. The first build-security run used npm older than CI requires and stopped at its existing npm version guard; rerunning with temporary npm12.2.0 and Node26.12.1. Full CI test profile started against the bundled CLI. Nix is not installed locally, so the actual shell and package checks will run in GitHub CI.

Final code verification at a4cb686: CI https://github.com/MrLesk/Backlog.md/actions/runs/39912878306 passed on Windows, Linux and macOS, all six native builds, actual Nix package and development-tools builds, and the nix develop inherited-CA check. Architecture comparison and CodeQL passed. Seven project build/CI certificate checks pass on temporary Node26.12.1/npm12.2.0. Full local CI profile: 3601 pass,13 skip,one archived-document terminal-display failure; the same failure was reproduced with clean-main source and a clean-main bundle. No viewer code changed. Implementer specification and quality reviews confirm all requested boundaries and unchanged fetch lifecycle. This is a bounded removal of policy, not a new architecture layer. No groma files changed.

Final task-record CI on top PR timed out in archive ID allocation and the private-proxy test, while the original code CI and bottom task-record Windows run passed. The archive test took 8.9 seconds even in its passing run. Its fixture uses initializeTestProject(false), where false controls autoCommit rather than filesystemOnly. This unexpectedly enables Git work for a scenario explicitly described as outside a Git repository. Correct fixture ownership and reduce unnecessary proxy setup child processes before rerunning platform verification.

Windows fixture correction passes locally: 40 Git/proxy/archive/worktree-allocation tests, types and Biome. Every assertion and the 10-second timeout are unchanged. Proxy setup now appends only its owned temporary Git config after one git init. Archive-ID tests use the existing filesystem-only initializer, matching their declared no-Git scenario. User authorized Docker validation; checking the Docker state before running an isolated Linux container.

Targeted final review after the Windows fixture corrections: all proxy and archive/ID assertions remain intact, with no timeout, retry or worker-limit changes. Corrected Windows CI passes 481 tests: the archive-ID case takes305ms and the private-proxy case1615ms. Current Linux and macOS unit checks also pass, along with six-target native builds. Nix application source (flake.nix, runtime Git operations and installed-package smoke) is unchanged from the already green full Nix code run at a85a2a8 on the top stack; current automatic Nix jobs are still running and will gate merge. Docker validation was attempted at Alexs request but startup required macOS administrator approval while the Mac was locked. No container was created. Docker startup processes and the pending approval prompt were cancelled; a final process check confirms Docker is closed. No Docker settings were changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored native Git certificate/proxy ownership and removed Nix development-shell trust overrides. Project build/release protections stay scoped to their own commands. The private-proxy regression fails before and passes after. Corrected Windows fixture setup preserves all assertions and the10-second limit; Windows/Linux/macOS unit checks and six native builds pass. The unchanged Nix application flow passed the real Nix checks; final automatic workflow status is tracked on PR#1136 and stack#1138. Docker was blocked by administrator approval and was closed; no container was created.
<!-- SECTION:FINAL_SUMMARY:END -->
