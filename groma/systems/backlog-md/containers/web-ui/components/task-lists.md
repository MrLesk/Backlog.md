---
type: C4 Component
title: Task lists
status: stable
groma:
  id: task-lists
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/TaskList.tsx
    - scanner: typescript
      file: src/web/components/TaskList.tsx
      symbol: TaskList
    - scanner: react
      file: src/web/components/DraftsList.tsx
    - scanner: typescript
      file: src/web/components/DraftsList.tsx
      symbol: DraftsList
  group: Pages
description: All Tasks and Drafts lists with search and filters
---

The All Tasks list with search and status, label and other filters, and the Drafts list, where drafts open for editing and can be promoted to tasks.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/TaskList.tsx](../../../../../../src/web/components/TaskList.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Searches tasks | In-process call |
| [src/web/components/DraftsList.tsx](../../../../../../src/web/components/DraftsList.tsx) | [src/server/index.ts](../../../../../../src/server/index.ts) | Loads and promotes drafts | HTTP |
| [src/web/components/DraftsList.tsx](../../../../../../src/web/components/DraftsList.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Opens a draft | React props |
| [src/web/components/TaskList.tsx](../../../../../../src/web/components/TaskList.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Opens a task | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/DraftsList.tsx](../../../../../../src/web/components/DraftsList.tsx) | [src/server/index.ts](../../../../../../src/server/index.ts) | Calls HTTP endpoints: GET /api/drafts, POST /api/drafts/:id/promote | react, typescript |
| [src/web/components/DraftsList.tsx](../../../../../../src/web/components/DraftsList.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callback: onEditTask | react |
| [src/web/components/TaskList.tsx](../../../../../../src/web/components/TaskList.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callbacks: onEditTask, onRefreshData | react |
