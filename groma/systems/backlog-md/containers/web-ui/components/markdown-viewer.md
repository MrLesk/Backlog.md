---
type: C4 Component
title: Markdown viewer
status: stable
groma:
  id: markdown-viewer
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/MermaidMarkdown.tsx
    - scanner: typescript
      file: src/web/components/MermaidMarkdown.tsx
      symbol: MermaidMarkdown
    - scanner: typescript
      file: src/web/utils/mermaid.ts
    - scanner: typescript
      file: src/web/utils/task-id-links.ts
    - scanner: react
      file: src/web/contexts/TaskIdIndexContext.tsx
    - scanner: typescript
      file: src/web/contexts/TaskIdIndexContext.tsx
  technology: '@uiw/react-md-editor, Mermaid'
description: Renders Markdown with Mermaid diagrams and clickable task IDs
---

Renders task, document and decision Markdown in the browser, draws Mermaid diagrams, and turns task IDs into links that open the task in place.
