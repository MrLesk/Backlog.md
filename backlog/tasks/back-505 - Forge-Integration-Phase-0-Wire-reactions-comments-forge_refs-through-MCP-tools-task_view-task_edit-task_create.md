---
id: BACK-505
title: >-
  Forge Integration Phase 0: Wire reactions, comments, forge_refs through MCP
  tools (task_view, task_edit, task_create)
status: To Do
assignee: []
created_date: '2026-05-17 19:54'
updated_date: '2026-05-17 19:58'
labels:
  - forge-schema
  - forge-integration
  - mcp
  - typescript
milestone: m-7
dependencies:
  - BACK-495
  - BACK-496
  - BACK-497
references:
  - >-
    backlog/docs/doc-5 -
    Forge-Integration-Feasibility-Study-—-Backlog.md-↔-Forgejo-GitHub-GitLab.md
priority: low
ordinal: 183500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After reactions (BACK-495), comments (BACK-496), and forge_refs (BACK-497) are implemented in the TypeScript core, this ticket wires them through the MCP tool surface.

**Scope:**
- `task_view` response: include `reactions`, `comments`, `forgeRefs` fields
- `task_edit` schema: accept `reactions` (dict) and `forgeRefs` (array) as update inputs
- `task_create` schema: accept `forgeRefs` on creation (reactions + comments are post-creation only)
- Verify MCP schema auto-generation picks up the new fields from TypeScript types
- Update tool descriptions to mention the new fields

**Out of scope in this ticket:** No new MCP tools (e.g., `task_add_reaction`, `task_add_comment`). Those come in Phase 3.

**This task MUST be on a clean branch from upstream-master and be a standalone PR.**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MCP `task_view` returns `reactions`, `comments`, `forgeRefs` in its response
- [ ] #2 MCP `task_edit` accepts `reactions` and `forgeRefs` parameters
- [ ] #3 MCP `task_create` accepts `forgeRefs` parameter
- [ ] #4 Existing MCP behavior unchanged for tasks without these fields
- [ ] #5 At least 1 test per new field in the MCP layer
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
