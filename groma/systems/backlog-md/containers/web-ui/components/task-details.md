---
type: C4 Component
title: Task details
status: stable
groma:
  id: task-details
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/TaskDetailsModal.tsx
    - scanner: typescript
      file: src/web/components/TaskDetailsModal.tsx
      symbol: TaskDetailsModal
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
description: View and edit one task in a modal
---

Shows and edits one task in a modal: description, acceptance criteria, Definition of Done, plan, notes, final summary, comments, labels, assignees, milestone, due date, references and dependencies, with the dependency graph and readiness. Saves through the API client and offers the complete and demote actions.

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
