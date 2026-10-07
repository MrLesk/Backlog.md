---
type: C4 Component
title: Core
status: stable
groma:
  id: core
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/backlog.ts
    - scanner: typescript
      file: src/index.ts
    - scanner: typescript
      file: src/utils/task-builders.ts
    - scanner: typescript
      file: src/utils/task-edit-builder.ts
      symbol: buildTaskUpdateInput
    - scanner: typescript
      file: src/types/task-edit-args.ts
    - scanner: typescript
      file: src/utils/assignee.ts
      symbol: normalizeAssignee
    - scanner: typescript
      file: src/utils/due-date.ts
      symbol: normalizeDueDate
    - scanner: typescript
      file: src/utils/task-updated-date.ts
      symbol: upsertTaskUpdatedDate
    - scanner: typescript
      file: src/utils/status-callback.ts
    - scanner: typescript
      file: src/utils/editor.ts
    - scanner: typescript
      file: src/core/reorder.ts
    - scanner: typescript
      file: src/utils/task-sorting.ts
    - scanner: typescript
      file: src/types/index.ts
  group: Shared core
description: Shared domain API every surface uses to read and change Backlog data
---

The Core class that the CLI, the terminal UI, the web server and the MCP server each create for a project. It validates input and performs every mutation: creating, editing, moving, reordering, completing, archiving, promoting and demoting tasks and drafts, and writing docs, decisions and milestones. It keeps the content store current, auto-commits through Git when configured, runs the optional status-change callback, and opens the developer's editor for raw edits. The shared domain types live here too.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | [src/file-system/operations.ts](../../../../../../src/file-system/operations.ts) | Saves and loads records | In-process call |
| [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | [src/git/operations.ts](../../../../../../src/git/operations.ts) | Auto-commits changes | In-process call |
| [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | [src/core/content-store.ts](../../../../../../src/core/content-store.ts) | Publishes saved tasks | In-process call |
| [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | [src/core/task-loader.ts](../../../../../../src/core/task-loader.ts) | Loads branch task state | In-process call |
| [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | [src/core/task-identity-index.ts](../../../../../../src/core/task-identity-index.ts) | Resolves task identities | In-process call |
| [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | [src/utils/status.ts](../../../../../../src/utils/status.ts) | Validates statuses | In-process call |
| [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | [src/core/config-migration.ts](../../../../../../src/core/config-migration.ts) | Migrates older configs | In-process call |
