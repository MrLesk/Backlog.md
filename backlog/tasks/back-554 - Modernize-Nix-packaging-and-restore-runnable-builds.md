---
id: BACK-554
title: Modernize Nix packaging and restore runnable builds
status: To Do
assignee: []
created_date: '2026-07-19 12:31'
updated_date: '2026-07-19 12:37'
labels:
  - nix
  - packaging
  - ci
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/801'
  - 'https://github.com/MrLesk/Backlog.md/issues/584'
  - 'https://nix-community.github.io/bun2nix/'
priority: high
type: bug
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The checked-in Nix path is pinned to bun2nix v1.5.1 from June 2025 and relies on legacy dependency generation, a custom baseline Bun overlay, and a Docker regeneration script. Issue #801 shows that the resulting x86_64-linux executable now segfaults before Backlog starts. Replace the legacy path as a coherent packaging refactor using a currently supported Nix and Bun packaging workflow. Preserve the public `nix build` and `nix run` experience, source-revision fidelity, reproducible offline dependency installation, and support for older x86_64 CPUs without AVX2. Remove obsolete machinery rather than layering another workaround over it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Building the default package and running `backlog --version` succeeds natively on x86_64-linux, including the baseline CPU compatibility promised after issue #412
- [ ] #2 `nix run github:MrLesk/Backlog.md -- --version` executes Backlog from the referenced source revision, and tagged revisions report their matching package version
- [ ] #3 Nix dependency resolution uses a current supported bun2nix API and generated dependency schema, with a documented deterministic update command that does not require Docker or the legacy v1 pin
- [ ] #4 The Nix package provides the same CLI capabilities and functional browser assets as the normal project build
- [ ] #5 The flake exposes a working default package, named package, default app, and development shell on every explicitly supported system, without claiming unsupported systems
- [ ] #6 Legacy bun2nix v1 APIs, the v1 dependency schema, Docker regeneration logic, package-install lifecycle side effects, and obsolete overlay or fixup machinery are removed; any remaining CPU-specific packaging has an explicit tested purpose
- [ ] #7 CI on native x86_64-linux runs both `nix build` and the produced `backlog --version`, and exercises enough packaged behavior to catch a corrupt or incomplete Bun executable
- [ ] #8 Nix installation and dependency-update documentation matches the new workflow and states the supported systems and CPU compatibility
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
