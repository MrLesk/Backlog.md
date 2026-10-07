---
type: C4 Component
title: Task identity
status: stable
groma:
  id: task-identity
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/task-identity-index.ts
    - scanner: typescript
      file: src/utils/task-id.ts
    - scanner: typescript
      file: src/utils/entity-id.ts
    - scanner: typescript
      file: src/utils/task-path.ts
    - scanner: typescript
      file: src/utils/prefix-config.ts
    - scanner: typescript
      file: src/utils/id-generators.ts
    - scanner: typescript
      file: src/utils/decision-id.ts
    - scanner: typescript
      file: src/utils/document-id.ts
    - scanner: typescript
      file: src/core/duplicate-task-repair.ts
    - scanner: typescript
      file: src/utils/duplicate-detection.ts
  group: Shared core
description: Parses, allocates and resolves IDs, and fails closed on ambiguity
---

Owns ID prefixes and numbering for tasks, subtasks, drafts, docs and decisions, maps IDs to files, and resolves an ID against the working copy and other branches. When two files claim one identity it refuses to guess and names both files. `backlog doctor` uses the duplicate detection and repair here to preview and fix duplicate task IDs.
