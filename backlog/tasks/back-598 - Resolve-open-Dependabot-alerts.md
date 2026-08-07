---
id: BACK-598
title: Resolve open Dependabot alerts
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 21:40'
updated_date: '2026-08-07 21:49'
labels:
  - security
dependencies: []
priority: medium
type: chore
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Dependabot reports five open alerts on main. All five are against a single direct devDependency, mermaid 11.16.0, and all five are fixed in mermaid 11.16.1.

Alerts:
- GHSA-rhh3-jpg6-66xh (medium): radar diagrams are vulnerable to DoS.
- GHSA-c4c3-pg64-4m4v (low): configuration APIs allow prototype pollution.
- GHSA-6x64-9x62-f2gx (medium): CSS injection applying to sibling elements of the diagram.
- GHSA-3rrr-jr9j-h3q3 (medium): architecture diagrams are vulnerable to prototype pollution.
- GHSA-2v8p-3f2j-5mp7 (medium): XY charts are vulnerable to an infinite loop DoS.

Reachability: Dependabot labels the scope as development, but mermaid is not dev-only in the shipped artifact. src/web/utils/mermaid.ts imports the prebuilt browser bundle and it is embedded in the compiled CLI binary, so mermaid renders task and document markdown in the local web UI. Mermaid is initialized with securityLevel strict.

Impact is bounded by the local trust boundary: the browser UI is loopback-only and renders markdown from the user own repository, so the realistic vector is a diagram authored by a contributor in a task or document file. The two DoS issues hang a local browser tab rather than a shared server, which makes them low consequence here. The prototype pollution and CSS injection issues matter more because the local web origin can write to the filesystem through its API.

Remediation is a single exact-version bump of the direct devDependency to 11.16.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mermaid resolves to exactly 11.16.1 in package.json and bun.lock
- [x] #2 The bun.lock delta touches only the mermaid entry and no other package
- [x] #3 Mermaid rendering in the web UI still works and its tests pass
- [x] #4 The compiled binary builds successfully after the bump
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify mermaid 11.16.1 is a genuine upstream security release before installing: check npm publish date, SLSA provenance, lifecycle scripts, dependency manifest, and diff the embedded sources against 11.16.0.
2. Bump the direct devDependency mermaid from 11.16.0 to exactly 11.16.1 in package.json.
3. Re-run bun i and confirm the bun.lock delta touches only the mermaid entry.
4. Verify with bunx tsc --noEmit, bun run check ., bun run build, and the full bun test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Supply-chain verification (done before installing, given the active Shai-Hulud npm worm campaign):

- mermaid 11.16.1 was published 2026-08-04, two days BEFORE the five advisories were published (2026-08-06). That is the normal coordinated-disclosure order: fix first, advisory after.
- The version is only 3 days old, which trips the "treat very recent publishes with suspicion" rule, so it was verified directly instead of trusted.
- npm provenance: valid SLSA attestation, built by a github-hosted runner from https://github.com/mermaid-js/mermaid, .github/workflows/release.yml, ref refs/heads/master. A stolen-token publish cannot forge this.
- Lifecycle scripts: byte-identical to 11.16.0. Neither version declares any install/preinstall/postinstall hook. mermaid is also absent from trustedDependencies, so Bun would not run lifecycle scripts for it even if one were added.
- Dependency manifest: byte-identical to 11.16.0. No new dependencies.
- Tarball: 1171 files in both versions. The only non-source file is LICENSE. No binaries, no shell scripts.
- IoC scan of the extracted tarball: no matches for webhook.site, npmjs.help, shai-hulud, bun_environment, setup_bun, trufflehog, NPM_TOKEN/GITHUB_TOKEN/AWS_SECRET exfil, child_process, net.Socket, or eval(atob).
- Source diff via sourcesContent embedded in the shipped sourcemaps: 393 sources in both versions, 0 added, 0 removed, exactly 8 changed, and every one maps to one of the five advisories. No unrelated code changed.
- None of the compromised Shai-Hulud families (keyv, cacheable, flat-cache, file-entry-cache) appear anywhere in bun.lock.

Conclusion: 11.16.1 is a genuine upstream security release. Bumped.

Per-alert triage:

| # | GHSA | Sev | Issue | Reachability in Backlog.md | Upstream fix in 11.16.1 |
|---|------|-----|-------|---------------------------|-------------------------|
| 13 | GHSA-rhh3-jpg6-66xh | medium | Radar diagram DoS via unbounded tick count | Low. Needs a radar diagram in repo markdown; hangs one local browser tab, not a shared server | Clamps ticks to a maximum of 32 |
| 12 | GHSA-c4c3-pg64-4m4v | low | Prototype pollution through the config APIs | Low. Backlog.md calls mermaid.initialize with a fixed literal config and never forwards untrusted input into it | setConfig now routes through the sanitizing updateCurrentConfig, and assignWithDepth uses Object.hasOwn plus Object.defineProperty instead of raw index assignment |
| 11 | GHSA-6x64-9x62-f2gx | medium | CSS injection applying to sibling elements of the diagram | Moderate. Diagram-supplied theme CSS could restyle surrounding web UI chrome, enabling local UI spoofing | Removed a leading space so the generated selector is "& {" rather than " & {", which had acted as a descendant combinator |
| 10 | GHSA-3rrr-jr9j-h3q3 | medium | Prototype pollution in architecture diagrams | Moderate. Node ids come straight from diagram text, so a contributed diagram using __proto__ as an id could poison Object.prototype in the web UI | Replaced the Record-based node/group/edge stores with Map, so diagram ids can no longer touch the prototype chain |
| 9 | GHSA-2v8p-3f2j-5mp7 | medium | XY chart infinite loop DoS | Low. Same bounded local-tab impact as the radar DoS | Guards the single-datum case that made step 0 and produced a non-terminating loop |

Scope note: Dependabot labels all five as scope "development", but that is inaccurate for the shipped artifact. src/web/utils/mermaid.ts imports mermaid/dist/mermaid.esm.mjs and the bundle is embedded in the compiled binary, confirmed by finding mermaid-architecture and flowchart-v2 markers inside dist/backlog. Mermaid does render repository markdown at runtime. Impact stays bounded because the browser server is loopback-only and the rendered content is the local repository, so the realistic vector is a diagram authored by a contributor in a task or document file. Mermaid is initialized with securityLevel strict, which already blocks script injection but does not cover the CSS or prototype pollution issues.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bumped the direct devDependency mermaid from 11.16.0 to exactly 11.16.1, which resolves all five open Dependabot alerts (GHSA-rhh3-jpg6-66xh, GHSA-c4c3-pg64-4m4v, GHSA-6x64-9x62-f2gx, GHSA-3rrr-jr9j-h3q3, GHSA-2v8p-3f2j-5mp7). No other dependency changed.

Because the target version was only 3 days old during an active npm worm campaign, it was verified rather than trusted: valid SLSA provenance from the official mermaid-js/mermaid release workflow, lifecycle scripts and dependency manifest byte-identical to 11.16.0, no binaries or IoC strings in the tarball, and a sourcemap-based source diff showing exactly 8 changed files that each map to one of the five advisories with no unrelated code.

Verified with: bun.lock diff limited to the two mermaid lines with the integrity hash matching the registry entry for 11.16.1; bunx tsc --noEmit clean; bun run check . clean across 358 files; bun run build producing a working 70 MB binary that reports version 1.49.3 and lists tasks; bun test at 1945 pass / 5 skip / 0 fail across 214 files; and src/test/mermaid.test.ts at 3 pass on its own.
<!-- SECTION:FINAL_SUMMARY:END -->
