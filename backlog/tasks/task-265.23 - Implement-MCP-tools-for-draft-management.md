---
id: task-265.23
title: Implement MCP tools for draft management
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-16T17:22:24.627Z'
updated_date: '2025-09-16 22:25'
labels:
  - mcp
  - tools
  - drafts
  - enhancement
dependencies:
  - task-265.22
parent_task_id: task-265
priority: high
---

## Description

Add comprehensive draft management tools to the MCP server, providing agents with the ability to work with draft tasks through the standardized protocol.
## Overview
Currently, the MCP server only supports tasks but not drafts. This creates a gap since the CLI has full draft support (`draft create`, `draft list`, `draft view`, `draft promote`, `draft archive`). Agents need these capabilities to manage the full task lifecycle.

## Tools to Implement

### 1. draft_create
- Create new draft tasks
- Parameters: title, description, labels, assignee, priority
- Returns: created draft ID and details
- Similar to task_create but sets status to "Draft"

### 2. draft_list
- List all drafts with optional filtering
- Parameters: assignee, labels, search, limit
- Returns: filtered list of drafts with metadata
- Similar to task_list but for drafts

### 3. draft_view
- Get detailed information about a specific draft
- Parameters: draftId
- Returns: complete draft details including all metadata
- Similar to task_view functionality

### 4. draft_promote
- Promote a draft to a full task
- Parameters: draftId, newStatus (optional)
- Returns: new task ID and updated details
- Implements the same logic as CLI `draft promote`

### 5. draft_archive
- Archive a draft (move to archive)
- Parameters: draftId
- Returns: success confirmation
- Implements CLI `draft archive` functionality

## Implementation Approach

1. **Create draft-tools.ts**: New file following the pattern of task-tools.ts
2. **Draft handlers**: Similar structure to TaskToolHandlers
3. **Schema validation**: Proper input schemas for each tool
4. **Integration**: Register tools in main server setup
5. **Testing**: Comprehensive tests for all 5 tools

## File Structure
```
/src/mcp/tools/draft-tools.ts
/src/mcp/tools/draft-handlers.ts (if needed)
/src/mcp/__tests__/unit/draft-tools.test.ts
```

## Dependencies
- Core draft functionality already exists in the filesystem layer
- Task tool patterns can be reused for consistency

## Overview
Currently, the MCP server only supports tasks but not drafts. This creates a gap since the CLI has full draft support (`draft create`, `draft list`, `draft view`, `draft promote`, `draft archive`). Agents need these capabilities to manage the full task lifecycle.

## Tools to Implement

### 1. draft_create
- Create new draft tasks
- Parameters: title, description, labels, assignee, priority
- Returns: created draft ID and details
- Similar to task_create but sets status to "Draft"

### 2. draft_list
- List all drafts with optional filtering
- Parameters: assignee, labels, search, limit
- Returns: filtered list of drafts with metadata
- Similar to task_list but for drafts

### 3. draft_view
- Get detailed information about a specific draft
- Parameters: draftId
- Returns: complete draft details including all metadata
- Similar to task_view functionality

### 4. draft_promote
- Promote a draft to a full task
- Parameters: draftId, newStatus (optional)
- Returns: new task ID and updated details
- Implements the same logic as CLI `draft promote`

### 5. draft_archive
- Archive a draft (move to archive)
- Parameters: draftId
- Returns: success confirmation
- Implements CLI `draft archive` functionality

## Implementation Approach

1. **Create draft-tools.ts**: New file following the pattern of task-tools.ts
2. **Draft handlers**: Similar structure to TaskToolHandlers
3. **Schema validation**: Proper input schemas for each tool
4. **Integration**: Register tools in main server setup
5. **Testing**: Comprehensive tests for all 5 tools

## File Structure
```
/src/mcp/tools/draft-tools.ts
/src/mcp/tools/draft-handlers.ts (if needed)
/src/mcp/__tests__/unit/draft-tools.test.ts
```

## Dependencies
- Core draft functionality already exists in the filesystem layer
- Task tool patterns can be reused for consistency

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All 5 draft tools (create, list, view, promote, archive) are functional
- [ ] #2 Can create drafts with proper metadata
- [ ] #3 Can list and filter drafts like tasks
- [ ] #4 Can promote drafts to tasks successfully
- [ ] #5 Can archive drafts
- [ ] #6 Comprehensive test coverage for all draft operations
- [ ] #7 Tools registered and accessible via MCP protocol
<!-- AC:END -->


## Implementation Plan

## IMPLEMENTATION PLAN FOR TASK-265.23

### Overview
Implement 5 draft management tools for MCP server following established patterns. Creates draft-handlers.ts and draft-tools.ts following task-tools.ts structure.

### Step-by-Step Implementation

#### 1. Core Implementation
**1.1 Create Draft Handlers Class** (src/mcp/tools/draft-handlers.ts)
- Mirror TaskToolHandlers structure 
- Implement 5 methods: createDraft, listDrafts, viewDraft, promoteDraft, archiveDraft
- Use existing filesystem operations: saveDraft(), loadDraft(), listDrafts(), promoteDraft(), archiveDraft()

**1.2 Create Draft Tools Registration** (src/mcp/tools/draft-tools.ts)
- Mirror task-tools.ts structure (253 lines)
- Define 5 JSON schemas: draftCreateSchema, draftListSchema, draftViewSchema, draftPromoteSchema, draftArchiveSchema
- Implement 5 tool creators following createAsyncValidatedTool/createSimpleValidatedTool patterns
- Create registerDraftTools(server: McpServer) function

#### 2. Schema Design
- **Draft Create**: title (required), description, labels, assignee, priority (no status/dependencies)
- **Draft List**: assignee, labels, search, limit filters
- **Draft View**: id field for single draft retrieval
- **Draft Promote**: id (required), optional status for initial task status
- **Draft Archive**: id field for archiving

#### 3. Registration Integration
- Update src/mcp-stdio-server.ts: import + registerDraftTools(mcpServer)
- Update src/cli.ts: import + registerDraftTools(server)

#### 4. Comprehensive Test Suite
- Unit tests: src/mcp/__tests__/unit/draft-tools.test.ts
- Integration tests: Add to mcp-server.test.ts
- Test all 5 tools, schema validation, error handling

#### 5. Quality Assurance
- bunx tsc --noEmit for type checking
- bun run check for linting
- bun test for all tests passing

### Files to Create/Modify
**New:** draft-handlers.ts (~200 lines), draft-tools.ts (~350 lines), draft-tools.test.ts (~400 lines)
**Modified:** mcp-stdio-server.ts (+2 lines), cli.ts (+2 lines), mcp-server.test.ts (+100 lines)

### Technical Approach
- Follow task-tools.ts patterns exactly (proven with 817 passing tests)
- Reuse validation infrastructure (createAsyncValidatedTool, createSimpleValidatedTool)
- Use existing filesystem operations (already implemented and tested)
- Mirror TaskToolHandlers class structure for consistency
