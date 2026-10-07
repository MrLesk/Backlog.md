---
type: C4 Component
title: Markdown format
status: stable
groma:
  id: markdown
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/markdown/parser.ts
    - scanner: typescript
      file: src/markdown/serializer.ts
    - scanner: typescript
      file: src/markdown/frontmatter.ts
    - scanner: typescript
      file: src/markdown/structured-sections.ts
    - scanner: typescript
      file: src/markdown/section-titles.ts
  group: Storage
  technology: gray-matter, YAML
description: Parses and writes task, doc and decision Markdown with YAML frontmatter
---

Defines the on-disk format. The parser reads YAML frontmatter and the structured sections (description, acceptance criteria, Definition of Done, plan, notes, final summary, comments) and tolerates hand-edited files; the serializer writes them back with a fixed field order so Git diffs stay small and readable.
