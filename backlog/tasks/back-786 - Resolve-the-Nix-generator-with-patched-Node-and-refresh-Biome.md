---
id: BACK-786
title: Protect native Git HTTPS fetches and Nix generator resolution
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-21T14:26:00Z'
updated_date: '2026-10-21T16:23:00Z'
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
  - .github/workflows/release.yml
  - .github/workflows/architecture.yml
  - scripts/ci-trust.test.cjs
  - flake.nix
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

Final bounded follow-through prepared while Action/Groma release pins are pending: all3public CI bootstrap copies now reject inherited Git TLS bypasses and append exact GitHub repo URL verification/Schannel policy above inherited PARAMETERS, preserving prior indexed/command auth.3persistent nativeNode regressions execute the actual YAML bootstrap programs and native Git matching/auth controls. Nix shellTrust remains the deliberately reproducible public CA selection already designed; it intentionally overrides host Git/npm CA policy. DEVELOPMENT now gives concrete post-nix-develop filtering and SSL_CERT_FILE/GIT_SSL_CAINFO/NPM_CONFIG_CAFILE export commands for required private roots, with empty CApath. No shell wrapper or hidden host trust union added. Runtime private Git policy outside explicit shell overrides remains preserved. Final architecture pins, hosted gates and task completion still pending.

Native match-then-path ordering follow-up: enumerating all CA entries with --path can reject an unrelated ~nonexistentuser value even when native URL matching would ignore it. Projection now enumerates raw CA values and applies native --path only after isolated --get-urlmatch selects the applicable value. Actual controls preserve a current-user ~/ private CA fixture, ignore unrelated unusable tilde paths, and reject a selected invalid path.32focusedGit tests146assertions, types551files and Biome474files pass; a preload mutation restoring early expansion reproduces the unrelated-entry exit128 and fails the regression. This bounded fix is held with final bootstrap/docs/pin changes; all3OS/all6build gates for preceding e0f are green, exact final head still required.

Public CI bootstrap guards also export NODE_TLS_REJECT_UNAUTHORIZED=1, matching Action/Groma. The existing3actual-YAML regressions inject inherited0 and run real native HTTPS server/client controls: beforebootstrap each private untrusted peer reaches1HTTP; afterexport it completes certificate rejection with0HTTP. No OS trust mutation or new framework; all3cases pass. Shell trust selection remains unchanged. Preceding e0f hosted matrix is now fullygreen including Nix,3OS suites,6binarycompiles and fullLinuxDOM/TUI. Final approvedsource/pins head remains pending exactAction/Groma release commits.

Final source integration now pins the exact planned Action version tag v1.2.2 and Groma0.7.4 (AGENTS has no fullSHA requirement). The specific Action release tag and CLI publication remain external gates: no moving v1 pin, bypass or fallback is allowed. Removed temporary Node24 prewarm/manualnpm because the new composite provisions patchedNode26/npm12; restored normal trusted-main architecture scanning, retaining committed-only PR comparisons and firstTLSbootstrap in everyjob. Publish this finalsourcehead now so full3OS/Nix/reviews run in parallel; architecture must be rerun unchanged after actual Action/Groma publication. Release-dependent acceptance remains pending and task stays InProgress.

Final security review reproduced native Git HTTPS-proxy leakage: with explicit incident proxy CAs, raw Git sent one proxy HTTP request plus fake Proxy-Authorization for private, emudhra and AAA chains. A filtered proxy CAfile alone still accepted the emudhra chain through libcurl compiled proxy CApath; Git 2.51.1/2.56 expose proxySSLCAInfo but no proxy CApath setting. Do not rely on nonexistent proxySSLVerify/GIT_PROXY_SSL_NO_VERIFY controls. The bounded hotfix explicitly blocks native Git HTTPS proxies with an owned empty GIT_PROXY_SSL_CAINFO file for HTTP and HTTPS origins, CI and the Nix shell. Direct HTTPS and ordinary HTTP CONNECT proxies remain supported; SSH/local remotes are unchanged. This material HTTPS-proxy restriction is documented with direct/HTTP-proxy/offline alternatives. Real native controls prove all six private/incident and HTTP/HTTPS-origin raw proxy cases transmit one request with fake auth before the guard, then complete a certificate-file rejection with zero requests/auth after it; direct unused invalid proxy CA and HTTP CONNECT private-origin/auth positives pass. Windows canonical/lowercase proxy environment cases and hosted full matrix/Nix remain final gates. 9365 prior Nix and all six compiled smoke jobs passed; its unrelated Windows archived-ID test timed out and cascaded, with no timeout or assertion changes made.

Final proxy source delta independently reviewed and approved by parent. Local validation after the exact runtime/workflow/Nix/doc/test delta: 39 focused native Git/operations tests pass with 171 assertions; 7 native Node updater/bootstrap tests pass; bun --check reports no type errors in 551 files; Biome checks 474 files clean; git diff --check clean. Full exact-head Linux/macOS/Windows, six binary builds, Nix realization and branch-source architecture integration remain pending. Release-dependent acceptance stays open until Action v1.2.2 and Groma 0.7.4 are actually published.

Hosted validation caught a portability defect before release: current Action Ubuntu Git2.55/libcurl imported zero authorities from an empty proxy CAfile then fell back to the system proxy CApath, accepting the emudhra proxy and sending CONNECT/auth. The initial empty-file Backlog head19e286b is blocked from merge/release. Replace it with ENOTDIR: GIT_PROXY_SSL_CAINFO points beneath an owned regular marker file, so loading cannot succeed or become valid while the marker exists. Native Linux proof gives completed loader failure and zero HTTP/auth on all private/emudhra/AAA proxy chains. Git also clears proxy CAinfo when Schannel CA-file opt-in is false; apply the existing exact origin strict flags to HTTP as well as HTTPS, while origin CA matching/filtering remains HTTPS-only. Windows raw controls use the same native Git OpenSSL backend and retain strict1-request/auth before and0 after; additional Schannel cases require exact owned-path loader failure, avoiding false success from ambient OS revocation. Earlier19e Windows raw incident cases returned CRYPT_E_REVOKED (one first lookup timed out); OS stores and production revocation policy remain unchanged. Final focused checks and hosted matrix remain required.

Corrected ENOTDIR guard and shared HTTP/HTTPS exact Schannel opt-in independently approved by parent. Final local validation passes:39 focused Git/operations tests177 assertions;7 native Node updater/bootstrap tests;551-file type check;474-file Biome check; git diff --check. The Windows tests use native Git OpenSSL for paired unsafe raw1HTTP/auth→guard0 controls, with separate Schannel guards requiring completed rejection mentioning the owned impossible path (not revocation or timeout). Current code/security reviews and complete exact-head CI/Nix/branch-source architecture remain release gates.
<!-- SECTION:NOTES:END -->
