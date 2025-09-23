---
id: task-265.39
title: Fix MCP draft handler to use Core generateNextId
status: To Do
assignee: []
created_date: '2025-09-23 14:03'
labels:
  - mcp
  - bug-fix
  - id-generation
dependencies: []
parent_task_id: task-265
priority: high
---

## Description

Replace custom ID generation in MCP draft handler with Core API and fix draft ID format.

Issue: MCP draft handler reimplements ID generation (lines 24-30) and incorrectly uses draft- prefix instead of task- prefix that CLI uses.

Changes Required:
1. Delete lines 24-30 in src/mcp/tools/draft-handlers.ts  
2. Replace with: const newId = await this.server.generateNextId()
3. Remove draft counting and manual ID construction
4. Fix draft ID format to use task- prefix (drafts are tasks with Draft status)

Files to Modify:
- src/mcp/tools/draft-handlers.ts (createDraft method)

Background:
- CLI creates drafts with task- IDs, not draft- IDs
- Drafts are just tasks with status Draft
- Core generateNextId provides proper distributed ID generation

Benefits:
- Matches CLI draft creation exactly
- Uses proper task- prefix for drafts
- Eliminates duplicate ID generation code
- Supports git branch-aware ID generation

Acceptance Criteria:
- MCP draft creation uses Core generateNextId method
- Drafts created with task-XXX format (not draft-XXX)
- Draft ID generation matches CLI behavior exactly
- No custom ID counting logic remains
