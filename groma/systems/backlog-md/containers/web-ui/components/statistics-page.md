---
type: C4 Component
title: Statistics page
status: stable
groma:
  id: statistics-page
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/Statistics.tsx
    - scanner: typescript
      file: src/web/components/Statistics.tsx
      symbol: Statistics
  group: Pages
description: Status, priority and project health numbers for the whole project
---

Shows task counts by status and priority, completion, recent activity, and stale and blocked tasks from the server's statistics endpoint. Tasks listed there open in the task details modal.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/Statistics.tsx](../../../../../../src/web/components/Statistics.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Loads statistics | In-process call |
| [src/web/components/Statistics.tsx](../../../../../../src/web/components/Statistics.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Opens a task | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/Statistics.tsx](../../../../../../src/web/components/Statistics.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callback: onEditTask | react |
