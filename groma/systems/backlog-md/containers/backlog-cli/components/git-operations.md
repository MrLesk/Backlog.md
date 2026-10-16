---
type: C4 Component
title: Git operations
status: stable
groma:
  id: git-operations
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/git/operations.ts
  group: Storage
  technology: git CLI
description: Runs git for auto-commits and cross-branch reads
---

Wraps the git command line. It stages and commits task changes (with --no-verify when bypassGitHooks is set), lists local, remote and recent branches and worktrees, fetches remotes, and reads trees and file contents from other refs for cross-branch loading. Remote operations can be switched off in config.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/git/operations.ts](../../../../../../src/git/operations.ts) | [git](../../../../../externals/git.md) | Runs git commands | git CLI |
