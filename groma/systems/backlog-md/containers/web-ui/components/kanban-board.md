---
type: C4 Component
title: Kanban board
status: stable
groma:
  id: kanban-board
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/Board.tsx
    - scanner: typescript
      file: src/web/components/Board.tsx
      symbol: Board
    - scanner: react
      file: src/web/components/BoardPage.tsx
    - scanner: typescript
      file: src/web/components/BoardPage.tsx
      symbol: BoardPage
    - scanner: react
      file: src/web/components/TaskColumn.tsx
    - scanner: typescript
      file: src/web/components/TaskColumn.tsx
      symbol: TaskColumn
    - scanner: react
      file: src/web/components/TaskCard.tsx
    - scanner: typescript
      file: src/web/components/TaskCard.tsx
      symbol: TaskCard
    - scanner: react
      file: src/web/components/BoardLoadingSkeleton.tsx
    - scanner: typescript
      file: src/web/components/BoardLoadingSkeleton.tsx
      symbol: BoardLoadingSkeleton
    - scanner: typescript
      file: src/web/lib/lanes.ts
    - scanner: typescript
      file: src/web/utils/kanban-tasks.ts
      symbol: filterKanbanTasks
    - scanner: react
      file: src/web/components/AcceptanceCriteriaProgress.tsx
    - scanner: typescript
      file: src/web/components/AcceptanceCriteriaProgress.tsx
    - scanner: react
      file: src/web/components/ProjectBadge.tsx
    - scanner: typescript
      file: src/web/components/ProjectBadge.tsx
      symbol: ProjectBadge
    - scanner: react
      file: src/web/components/TaskTypeBadge.tsx
    - scanner: typescript
      file: src/web/components/TaskTypeBadge.tsx
      symbol: TaskTypeBadge
  group: Pages
description: Drag-and-drop board with status columns and milestone lanes
---

The board page: a column per status, optional milestone lanes, filters, drag-and-drop reordering and multi-select moves. Cards show type, project, priority and an acceptance-criteria progress ring.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/Board.tsx](../../../../../../src/web/components/Board.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Moves and reorders tasks | In-process call |
| [src/web/components/BoardPage.tsx](../../../../../../src/web/components/BoardPage.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Opens a task | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/BoardPage.tsx](../../../../../../src/web/components/BoardPage.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callback: onEditTask | react |
