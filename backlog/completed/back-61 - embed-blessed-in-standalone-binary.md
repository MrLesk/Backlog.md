---
id: BACK-61
title: Embed blessed in standalone binary
status: Done
assignee:
  - '@codex'
created_date: '2025-06-14'
updated_date: '2025-06-15'
labels:
  - cli
  - packaging
dependencies: []
---

## Description

When running the Backlog CLI installed from npm, the compiled executable fails if `blessed` isn't available in the current project. This prevents usage in non‑JavaScript repositories. Update the build process so that the standalone binary bundles `blessed` and other npm dependencies directly.

## Acceptance Criteria
- [x] Build scripts compile without `--external blessed`
- [x] CI and release workflows build binaries that include dependencies
- [x] `backlog` runs globally without installing blessed locally

## Implementation Notes

The task was successfully completed. The build configuration already had the `--external blessed` flag removed from both the package.json and CI/CD workflows. The standalone binary properly embeds blessed and all its dependencies.

### Key Changes:
1. Verified that build scripts in package.json compile without `--external blessed` flag
2. Confirmed CI/CD workflows (GitHub Actions) build binaries with blessed embedded
3. Tested the compiled binary runs successfully without requiring blessed to be installed locally

### Testing:
- Built a standalone binary using `bun build src/cli.ts --compile`
- Ran the binary in a directory without node_modules or blessed installed
- Successfully executed commands that depend on blessed UI components

### Update:
With the migration to bblessed (github:context-labs/bblessed), the bundling is even more reliable as bblessed is specifically designed for Bun's compilation and bundling process.