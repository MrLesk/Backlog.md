---
id: task-70
title: 'CI: eliminate extra binary download'
status: Done
assignee:
  - '@codex'
created_date: '2025-06-15'
updated_date: '2025-06-15'
labels:
  - ci
  - packaging
dependencies: []
---

## Description

Review the CI and release workflows to package platform-specific binaries directly through npm. The goal is to let users run `bun add -g backlog.md` on any platform and receive the correct compiled binary without a separate download step. The current solution downloads the binary from GitHub releases because bundling all binaries would exceed npm's size limit (~80MB each).

## Acceptance Criteria

- [x] Release workflow builds and publishes one npm package per platform containing its binary only.
- [x] The main `backlog.md` package depends on the correct platform package so installation pulls the binary automatically.
- [x] Documentation explains the simplified global install.

## Implementation Notes

The platform-specific package publishing was not working because:

1. The `publish-binaries` job was missing the `npm-publish` dependency, causing potential race conditions
2. The job wasn't checking out the repository, so it couldn't access LICENSE and README files

Changes made:
- Fixed the `publish-binaries` job to depend on both `build` and `npm-publish` jobs
- Added `actions/checkout@v4` step to access repository files
- Removed old download scripts (`cli-download.cjs` and `getBinaryName.cjs`) that are no longer needed
- The CLI wrapper (`scripts/cli.cjs`) already properly resolves platform packages

The solution allows users to install with `npm i -g backlog.md` or `bun add -g backlog.md` and automatically get the correct platform binary through npm's optional dependencies mechanism.
