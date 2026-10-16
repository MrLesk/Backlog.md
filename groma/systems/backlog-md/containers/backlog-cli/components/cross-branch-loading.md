---
type: C4 Component
title: Cross-branch loading
status: stable
groma:
  id: cross-branch-loading
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/task-loader.ts
    - scanner: typescript
      file: src/core/cross-branch-tasks.ts
  group: Shared core
description: Reads task state from other Git branches and remotes
---

Lets the board show work that lives on recent feature branches. It indexes task files on local and remote branches changed within activeBranchDays, reads full files only where needed, and picks each task's most progressed copy. It is skipped when checkActiveBranches is off or the project has no Git.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/core/task-loader.ts](../../../../../../src/core/task-loader.ts) | [src/git/operations.ts](../../../../../../src/git/operations.ts) | Reads other branches | In-process call |
| [src/core/task-loader.ts](../../../../../../src/core/task-loader.ts) | [src/markdown/parser.ts](../../../../../../src/markdown/parser.ts) | Parses branch copies | In-process call |
