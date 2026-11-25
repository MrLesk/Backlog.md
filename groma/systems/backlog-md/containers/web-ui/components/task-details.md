---
type: C4 Component
title: Task details
status: stable
groma:
  id: task-details
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/AcceptanceCriteriaEditor.tsx
    - scanner: typescript
      file: src/web/components/AcceptanceCriteriaEditor.tsx
      symbol: AcceptanceCriteriaEditor
    - scanner: react
      file: src/web/components/ChipInput.tsx
    - scanner: typescript
      file: src/web/components/ChipInput.tsx
      symbol: ChipInput
    - scanner: react
      file: src/web/components/DependencyInput.tsx
    - scanner: typescript
      file: src/web/components/DependencyInput.tsx
      symbol: DependencyInput
    - scanner: react
      file: src/web/components/DependencyGraphSection.tsx
    - scanner: typescript
      file: src/web/components/DependencyGraphSection.tsx
      symbol: DependencyGraphSection
description: View and edit one task as a page over the page it was opened from
---

Shows one task as a page in the content panel, over the page the task was opened from, which stays on screen beneath it and keeps its state: a breadcrumb back to that page, the title, the sections in a reading column (description, subtasks, acceptance criteria, Definition of Done, dependency graph, plan, notes, comments, final summary) and beside them the properties (status, priority, assignees, type, labels, project, milestone, due date, parent, dependencies with their readiness, branch and dates) followed by the references, modified files and documentation panels. Properties change in place; the title and the text sections change in edit mode, with Save and Cancel. Demote to draft and Archive sit in a More actions menu. The same component draws the dialog that creates a task or a draft. Every link to a task follows one rule, so a task opens the same way from anywhere and closing it returns to the page beneath. Saves through the API client.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/TaskDetailsModal.tsx](../../../../../../src/web/components/TaskDetailsModal.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Saves task changes | In-process call |
| [src/web/components/TaskDetailsModal.tsx](../../../../../../src/web/components/TaskDetailsModal.tsx) | [src/web/components/MermaidMarkdown.tsx](../../../../../../src/web/components/MermaidMarkdown.tsx) | Renders task Markdown | In-process call |
| [src/web/components/TaskDetailsModal.tsx](../../../../../../src/web/components/TaskDetailsModal.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Reports task changes | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/TaskDetailsModal.tsx](../../../../../../src/web/components/TaskDetailsModal.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callbacks: onClose, onDependencyCleanup, onNavigateToTask, onSaved, onSubmit | react |
