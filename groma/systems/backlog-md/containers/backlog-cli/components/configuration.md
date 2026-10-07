---
type: C4 Component
title: Configuration
status: stable
groma:
  id: configuration
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/constants/index.ts
    - scanner: typescript
      file: src/utils/priority-config.ts
    - scanner: typescript
      file: src/utils/project-config.ts
    - scanner: typescript
      file: src/utils/task-type-config.ts
    - scanner: typescript
      file: src/utils/status.ts
    - scanner: typescript
      file: src/utils/terminal-status.ts
    - scanner: typescript
      file: src/core/config-migration.ts
    - scanner: typescript
      file: src/core/prefix-migration.ts
    - scanner: typescript
      file: src/utils/app-info.ts
      symbol: getPackageName
    - scanner: typescript
      file: src/utils/version.ts
      symbol: getVersion
  group: Shared core
description: Project defaults, statuses, priorities, types and config migrations
---

Built-in defaults (folders, statuses, files) and the configurable vocabularies every surface validates against: statuses and the final done status, priorities, task types and projects. It also migrates older config files and draft file names, and reports the running version.
