---
id: BACK-449
title: Document task image handling and docs management in agent guidelines
status: To Do
assignee: []
created_date: '2026-04-26 13:05'
labels:
  - documentation
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document agent-facing guidance for task image assets and the document-management public APIs after the document CLI/MCP/Web cleanup. The guidance should explain local backlog assets for task images and align docs-management instructions with the shared document create/update/list/view/search contract from CLI, Web, and MCP.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Agent guidelines document task image asset storage, supported formats, Markdown references, and browser serving behavior.
- [ ] #2 Agent guidelines document the current docs-management public surface without telling agents to rely on stale or source-only behavior.
- [ ] #3 Guidance matches the recent document cleanup: docs paths are relative to backlog/docs, unsafe paths are rejected, CLI supports doc create/list/view, and MCP/Web provide document update behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
