---
id: task-265.23
title: Implement MCP tools for draft management
status: "\U0001F4CB Ready"
assignee: []
created_date: '2025-09-16T17:22:24.627Z'
labels:
  - mcp
  - tools
  - drafts
  - enhancement
dependencies:
  - task-266
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
