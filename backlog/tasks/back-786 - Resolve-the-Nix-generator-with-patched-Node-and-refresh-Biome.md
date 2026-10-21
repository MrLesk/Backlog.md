---
id: BACK-786
title: Protect native Git HTTPS fetches and Nix generator resolution
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-21T14:26:00Z'
updated_date: '2026-10-21T15:24:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1131
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
priority: high
type: bug
ordinal: 396000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up review of BACK-785 reproduced loss of the explicit cafile restriction in Bun 1.4.3 bun x package resolution under affected/custom trust. Replace the Nix updater resolution path with verified local bun2nix or strict native npm on patched Node, refresh now-published Biome 2.6.2, and regenerate dependency artifacts without changing the released root version.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The updater rejects unpatched Node and missing, unreadable, or empty CA files before package resolution; local bun2nix is used only after verifying version 2.1.2.
- [x] #2 Fallback resolution uses native npm under the same patched Node with explicit cafile and strict SSL, preserves native auth/proxy configuration, and no Nix generator path invokes bunx.
- [ ] #3 CI and documentation use the shared updater; Biome 2.6.2 and regenerated Bun/Nix artifacts pass focused security regressions and required project checks.
- [ ] #4 One follow-up PR links issue 1131 and records exact validation plus any residual upstream runtime limitations; package.json version remains release-workflow controlled.
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
1. Replace bunx generator resolution with a minimal patched-Node helper, validating CA input before resolution and checking local bun2nix version before use. 2. Add behavior/security regressions for fail-closed preconditions, local version selection, strict npm child execution, and TLS rejection under inherited incident trust. 3. Upgrade verified Biome 2.6.2 and regenerate format-1 Bun lock and bun.nix using bun2nix 2.1.2. 4. Run lint/types/full meaningful suites and Nix/hosted gates; publish one reviewable follow-up PR for GitHub Release 1.55.2.

5. Confirmed task reads and ID allocation use native Git HTTPS. Apply filtered CA trust only to existing HTTPS fetch children, preserving effective Git CA/auth/proxy and indexed config while rejecting inherited TLS bypass; add real native Git positive/negative regressions and run them across all three hosted platforms.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Follow-up source review corrected the prior no-external-HTTPS statement: task reads and ID allocation invoke native Git fetch. HTTPS-only child trust now preserves explicit private-only CA policy, inherited indexed config/auth/proxy, and existing timeout/coalescing; filters all incident keys; removes the inherited Git TLS opt-out; and opts Schannel into the CA file. Real Git private-positive/header-preservation and both incident-zero-HTTP controls pass. A temporary mutation bypassing the new wrapper reproduces a compromised-chain HTTP request and fails the regression. Compiled native binary prints1.55.1 and help without triggering the shared CJS filter CLI; standalone Node filter command also passes. Biome2.6.2 native Linux archive SHA512 was independently verified and the installed executable reports2.6.2. Native npm TLS controls pass; dependency audit is empty. Full isolated project suite currently running; exact-head hosted3-platform/Nix gates remain required.

Final pre-PR validation:30focused Git tests pass, including native private RSA and Linux Ed448 positives, preserved fake auth/indexed configuration, username-specific sslVerify=false, inherited GIT_SSL_NO_VERIFY=false, and both incident paths with zero HTTP requests. Strict URL-specific settings append after inherited Git indices; passwords are excluded from the new child settings. Ed448 fallback SPKI independently matches patched Node26 and OpenSSL: SHA256 c1071173f9f1ef1c78a8f041eec6372c0af9b893b140fd13d2ea08aaef7821b3,69bytes; malformed DER/PEM fails closed. Full isolated suite:3203pass,13skip,1existing interactive rendering failure under TERM=dumb/NO_COLOR=1; unchanged PTY target passes when rerun with TERM=xterm-256color and NO_COLOR unset. DOM suite399pass. Node updater4security cases pass, types550files and Biome473files pass, dependency audit empty, format1Bun lock preserved and bun.nix regenerated by actual npm fallback. Static CJS filter CLI/main guard verified in compiled CLI --version/--help plus standalone Node filter invocation. Local Nix executable was lost; no redundant SDK restoration, hosted Nix realization remains required. Exact action/Groma follow-up CI pins will be updated only after their reviewed sources/releases are available; root version remains1.55.1 until GitHubRelease workflow.

Native Git negative fixtures also capture the real fetch child error through the existing private execGit seam: require a completed certificate rejection and zeroHTTP, reject timeouts/spawn failures, and print chain/error on failure. Private cases require a completed fixture404 plus expected preserved fake auth. No request-count-only pass is treated as rejection.

Action Windows diagnostics isolated incomplete incident peer chains as a native verifier stall after handshake/privateCA import. Applied the same fixture-only completion here by appending the existing public terminal ECC-G3/AAA roots served by the mock TLS peer; client CA trust is unchanged. Actual certificate rejection/zeroHTTP and existing timeouts stay required. AIA lookup remains an inference until Windows evidence confirms completed rejection.

Fail-closed review distinguished absent from explicitly empty Git CA configuration: --null --get-urlmatch emits no bytes for absence and one NUL for an empty value. Runtime now retains that distinction and rejects empty CAfile selections (including GIT_SSL_CAINFO=empty) instead of inheriting public defaults. Real native Git valid empty config/environment regression passes before any fetch, and all31focused Git tests/types550files/Biome473files pass. Empty CApath remains an empty fallback directory; explicit updater SSL_CERT_FILE selection remains its documented intentional trust policy, without a new npm-policy layer.

Windows child-environment follow-up: read only Git CAINFO/CAPATH/CONFIG_COUNT case-insensitively on Windows; delete inherited case variants only for keys explicitly replaced or omitted by execGit options.env. Unrelated environment and untouched indexed authentication retain their original spelling. Windows native TLS fixture now runs canonical and lower-case-only CAfile/CApath/count/indexed auth/bypass inputs; lower-case env CA must override a deliberately different configured CA. Private-positive/auth and both incident completed-rejection/zeroHTTP assertions remain required. Unix case semantics are unchanged. Local31Git tests/types/lint pass; actual Windows variant awaits hosted final head.

Codex review follow-up: inherited GIT_CONFIG_PARAMETERS can outrank indexed TLS flags; native Git control returned false before the fix and true after appending separately quoted exact URL key/value pairs. Preserve opaque inherited command-scope auth/proxy entries and raw username spelling (Git distinguishes raw reserved = from %3D, unlike WHATWG href). Credential-safe CA lookup reads only ordered CA entries with native --path, pseudonymizes equivalent usernames, then delegates matching to isolated Git --file - stdin; passwords and token-as-username never enter the new lookup argv. Native controls cover encoded unreserved names, reserved =, token usernames, wildcard paths, insteadOf, and exclusive private CA selection; malformed scopes fail generically. Every Git TLS chain now first proves unfiltered native acceptance at the mock404, and Git/npm fixtures explicitly require current leaf validity so expiry cannot silently satisfy negatives.32focused Git tests134assertions, types550files, Biome473files and4native updater tests pass. A preload mutation omitting the new PARAMETERS override reproduces1HTTP through the incident emudhra chain and fails the regression; unchanged fixed source passes. Previous a01 hosted matrix was fully green including full Linux and Nix; latest preceding cfd Windows/mac/all6compiles are green. Exact new-head3-platform/Nix and final action/Groma architecture pins still gate release.
<!-- SECTION:NOTES:END -->
