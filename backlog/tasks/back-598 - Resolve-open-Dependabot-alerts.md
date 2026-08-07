---
id: BACK-598
title: Resolve open Dependabot alerts
status: To Do
assignee:
  - '@claude'
created_date: '2026-08-07 21:40'
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
- [ ] #1 mermaid resolves to exactly 11.16.1 in package.json and bun.lock
- [ ] #2 The bun.lock delta touches only the mermaid entry and no other package
- [ ] #3 Mermaid rendering in the web UI still works and its tests pass
- [ ] #4 The compiled binary builds successfully after the bump
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
