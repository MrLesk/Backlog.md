---
type: C4 Component
title: Task browser
status: stable
groma:
  id: task-browser
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/ui/task-viewer-with-search.ts
  group: Terminal UI
  technology: neo-neo-bblessed
description: Searchable task list and detail pane in the terminal
---

The interactive view behind `backlog task list` and `backlog task view`: a filterable, searchable list beside a detail pane that shows acceptance criteria, dependencies and readiness. Pressing edit opens the task file in the developer's editor through the core.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/task-viewer-with-search.ts](../../../../../../src/ui/task-viewer-with-search.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Loads and edits tasks | In-process call |
| [src/ui/task-viewer-with-search.ts](../../../../../../src/ui/task-viewer-with-search.ts) | [src/ui/components/generic-list.ts](../../../../../../src/ui/components/generic-list.ts) | Renders task lists | In-process call |
| [src/ui/task-viewer-with-search.ts](../../../../../../src/ui/task-viewer-with-search.ts) | [src/ui/unified-view.ts](../../../../../../src/ui/unified-view.ts) | Reports selection and filters | Callback |
| [src/ui/task-viewer-with-search.ts](../../../../../../src/ui/task-viewer-with-search.ts) | [src/utils/task-search.ts](../../../../../../src/utils/task-search.ts) | Searches and filters tasks | In-process call |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/ui/task-viewer-with-search.ts](../../../../../../src/ui/task-viewer-with-search.ts) | [src/ui/unified-view.ts](../../../../../../src/ui/unified-view.ts) | Invokes supplied callbacks: onFilterChange, onTaskChange, subscribeUpdates | typescript |
