---
type: C4 Component
title: Milestones page
status: stable
groma:
  id: milestones-page
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/MilestonesPage.tsx
    - scanner: typescript
      file: src/web/components/MilestonesPage.tsx
      symbol: MilestonesPage
    - scanner: react
      file: src/web/components/MilestoneTaskRow.tsx
    - scanner: typescript
      file: src/web/components/MilestoneTaskRow.tsx
      symbol: MilestoneTaskRow
    - scanner: typescript
      file: src/web/utils/milestones.ts
  group: Pages
description: Plan milestones and move tasks between them
---

Lists active and archived milestones with their tasks. People create, edit, archive and remove milestones here and drag tasks from one milestone to another.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/MilestonesPage.tsx](../../../../../../src/web/components/MilestonesPage.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Manages milestones | In-process call |
| [src/web/components/MilestonesPage.tsx](../../../../../../src/web/components/MilestonesPage.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Requests a data refresh | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/MilestonesPage.tsx](../../../../../../src/web/components/MilestonesPage.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callback: onRefreshData | react |
