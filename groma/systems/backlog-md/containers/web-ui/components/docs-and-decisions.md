---
type: C4 Component
title: Docs and decisions
status: stable
groma:
  id: docs-and-decisions
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/DocumentationDetail.tsx
    - scanner: typescript
      file: src/web/components/DocumentationDetail.tsx
      symbol: DocumentationDetail
    - scanner: react
      file: src/web/components/DecisionDetail.tsx
    - scanner: typescript
      file: src/web/components/DecisionDetail.tsx
      symbol: DecisionDetail
    - scanner: react
      file: src/web/components/AmbiguousIdNotice.tsx
    - scanner: typescript
      file: src/web/components/AmbiguousIdNotice.tsx
      symbol: AmbiguousIdNotice
  group: Pages
description: Read and edit project documents and decision records
---

Shows and edits documents from the docs tree and decision records, creates new ones, and reports an ambiguous ID instead of guessing which file to open.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/DocumentationDetail.tsx](../../../../../../src/web/components/DocumentationDetail.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Loads and saves docs | In-process call |
| [src/web/components/DecisionDetail.tsx](../../../../../../src/web/components/DecisionDetail.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Loads and saves decisions | In-process call |
| [src/web/components/DocumentationDetail.tsx](../../../../../../src/web/components/DocumentationDetail.tsx) | [src/web/components/MermaidMarkdown.tsx](../../../../../../src/web/components/MermaidMarkdown.tsx) | Renders doc Markdown | In-process call |
| [src/web/components/DecisionDetail.tsx](../../../../../../src/web/components/DecisionDetail.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Requests a data refresh | React props |
| [src/web/components/DocumentationDetail.tsx](../../../../../../src/web/components/DocumentationDetail.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Requests a data refresh | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/DecisionDetail.tsx](../../../../../../src/web/components/DecisionDetail.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callback: onRefreshData | react |
| [src/web/components/DocumentationDetail.tsx](../../../../../../src/web/components/DocumentationDetail.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callback: onRefreshData | react |
