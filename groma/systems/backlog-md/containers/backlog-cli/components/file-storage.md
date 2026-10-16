---
type: C4 Component
title: File storage
status: stable
groma:
  id: file-storage
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/file-system/operations.ts
    - scanner: typescript
      file: src/utils/backlog-directory.ts
    - scanner: typescript
      file: src/utils/find-backlog-root.ts
    - scanner: typescript
      file: src/utils/runtime-cwd.ts
    - scanner: typescript
      file: src/utils/document-path.ts
  group: Storage
  technology: Node fs, proper-lockfile
description: Reads and writes the backlog folder, with file locks
---

Reads and writes the backlog folder on disk. It finds the project root and the backlog directory (backlog/, .backlog/, a configured path, or BACKLOG_CWD), loads and saves config, and lists, loads, saves and moves tasks, drafts, completed and archived tasks, docs, decisions and milestones. Lock files guard writes and ID allocation so parallel agents and processes do not corrupt records or hand out the same ID twice.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/file-system/operations.ts](../../../../../../src/file-system/operations.ts) | [src/markdown/parser.ts](../../../../../../src/markdown/parser.ts) | Parses records | In-process call |
| [src/file-system/operations.ts](../../../../../../src/file-system/operations.ts) | [src/markdown/serializer.ts](../../../../../../src/markdown/serializer.ts) | Serializes records | In-process call |
| [src/file-system/operations.ts](../../../../../../src/file-system/operations.ts) | [backlog-folder](../../../../../externals/backlog-folder.md) | Reads and writes files | Markdown, YAML |
| [src/file-system/operations.ts](../../../../../../src/file-system/operations.ts) | [src/utils/task-path.ts](../../../../../../src/utils/task-path.ts) | Resolves IDs to files | In-process call |
