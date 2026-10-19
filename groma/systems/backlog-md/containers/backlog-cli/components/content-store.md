---
type: C4 Component
title: Content store
status: stable
groma:
  id: content-store
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/content-store.ts
    - scanner: typescript
      file: src/utils/config-watcher.ts
    - scanner: typescript
      file: src/utils/task-watcher.ts
  group: Shared core
  technology: fs.watch
description: In-memory snapshot of tasks, docs and decisions, kept fresh by file watchers
---

Loads the project's tasks, documents and decisions once, then watches the backlog folder and the config file so long-running processes see edits made anywhere else, whether by another CLI process, an agent or a text editor. Subscribers such as the web server and search are told about each change. The terminal UI uses the lighter task and config watchers that also live here.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/core/content-store.ts](../../../../../../src/core/content-store.ts) | [src/server/index.ts](../../../../../../src/server/index.ts) | Reports file changes | Event callback |
| [src/core/content-store.ts](../../../../../../src/core/content-store.ts) | [src/file-system/operations.ts](../../../../../../src/file-system/operations.ts) | Loads records | In-process call |
| [src/core/content-store.ts](../../../../../../src/core/content-store.ts) | [backlog-folder](../../../../../externals/backlog-folder.md) | Watches for changes | fs.watch |
| [src/utils/config-watcher.ts](../../../../../../src/utils/config-watcher.ts) | [src/ui/unified-view.ts](../../../../../../src/ui/unified-view.ts) | Reports config changes | Callback |
| [src/core/content-store.ts](../../../../../../src/core/content-store.ts) | [src/markdown/parser.ts](../../../../../../src/markdown/parser.ts) | Parses changed files | In-process call |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/utils/config-watcher.ts](../../../../../../src/utils/config-watcher.ts) | [src/ui/unified-view.ts](../../../../../../src/ui/unified-view.ts) | Invokes supplied callback: onConfigChanged | typescript |
