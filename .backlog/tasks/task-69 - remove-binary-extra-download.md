---
id: task-69
title: "CI: eliminate extra binary download"
status: In Progress
assignee:
  - '@codex'
created_date: '2025-06-15'
labels:
  - ci
  - packaging
dependencies: []
---

## Description

Review the CI and release workflows to package platform-specific binaries directly through npm. The goal is to let users run `bun add -g backlog.md` on any platform and receive the correct compiled binary without a separate download step. The current solution downloads the binary from GitHub releases because bundling all binaries would exceed npm's size limit (~80MB each).

## Acceptance Criteria

- [ ] Release workflow builds and publishes one npm package per platform containing its binary only.
- [ ] The main `backlog.md` package depends on the correct platform package so installation pulls the binary automatically.
- [ ] Documentation explains the simplified global install.
