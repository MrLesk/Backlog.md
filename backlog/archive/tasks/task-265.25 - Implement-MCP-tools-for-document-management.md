---
id: task-265.25
title: Implement MCP tools for document management
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-16T17:23:20.565Z'
updated_date: '2025-09-17 14:24'
labels:
  - mcp
  - tools
  - docs
  - enhancement
dependencies:
  - task-265.22
parent_task_id: task-265
priority: medium
---

## Description

Add document management capabilities to the MCP server, enabling agents to create, list, and view project documentation through the standardized protocol.
## Overview
The CLI supports document management (`doc create`, `doc list`, `doc view`) but the MCP server lacks these tools. This creates a gap for agents that need to manage project documentation, technical specs, and knowledge base content.

## Tools to Implement

### 1. doc_create
- **Purpose**: Create new markdown documents in the docs folder
- **Parameters**: 
  - title (required): Document title
  - content (optional): Initial document content
  - tags (optional): Document tags for categorization
  - category (optional): Document category/type
- **Returns**: Created document ID and file path
- **Implementation**: Uses filesystem.createDocument() or similar Core method
- **Format**: Creates `.md` files with proper frontmatter metadata

### 2. doc_list
- **Purpose**: List all documents with optional filtering
- **Parameters**:
  - category (optional): Filter by document category
  - tags (optional): Filter by tags
  - search (optional): Search in title/content
  - limit (optional): Limit number of results
- **Returns**: Array of document summaries with metadata
- **Format**: Each item includes title, ID, created date, tags, summary

### 3. doc_view
- **Purpose**: Get complete content of a specific document
- **Parameters**: 
  - docId (required): Document identifier
- **Returns**: Full document object with:
  - Metadata (title, created date, tags, category)
  - Complete markdown content
  - File path information
- **Usage**: Allows agents to read existing documentation

## Implementation Details

### File Structure
```
/src/mcp/tools/doc-tools.ts
/src/mcp/tools/doc-handlers.ts
/src/mcp/__tests__/unit/doc-tools.test.ts
```

### Core Integration
- Leverage existing document filesystem operations
- Follow established patterns from task-tools.ts
- Use consistent error handling and validation

### Schema Validation
```typescript
// doc_create schema
{
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    content: { type: "string", maxLength: 50000 },
    tags: { type: "array", items: { type: "string", maxLength: 50 } },
    category: { type: "string", maxLength: 100 }
  },
  required: ["title"]
}

// doc_list schema
{
  type: "object", 
  properties: {
    category: { type: "string", maxLength: 100 },
    tags: { type: "array", items: { type: "string", maxLength: 50 } },
    search: { type: "string", maxLength: 200 },
    limit: { type: "number", minimum: 1, maximum: 100 }
  },
  required: []
}

// doc_view schema  
{
  type: "object",
  properties: {
    docId: { type: "string", minLength: 1, maxLength: 100 }
  },
  required: ["docId"]
}
```

### Document Format
- Standard markdown files with YAML frontmatter
- Consistent metadata structure
- Support for tags and categorization

## Testing Requirements
- Test document creation with various content types
- Test listing with different filter combinations  
- Test viewing documents and proper content retrieval
- Test error handling for non-existent documents
- Test validation of input parameters

## Overview
The CLI supports document management (`doc create`, `doc list`, `doc view`) but the MCP server lacks these tools. This creates a gap for agents that need to manage project documentation, technical specs, and knowledge base content.

## Tools to Implement

### 1. doc_create
- **Purpose**: Create new markdown documents in the docs folder
- **Parameters**: 
  - title (required): Document title
  - content (optional): Initial document content
  - tags (optional): Document tags for categorization
  - category (optional): Document category/type
- **Returns**: Created document ID and file path
- **Implementation**: Uses filesystem.createDocument() or similar Core method
- **Format**: Creates `.md` files with proper frontmatter metadata

### 2. doc_list
- **Purpose**: List all documents with optional filtering
- **Parameters**:
  - category (optional): Filter by document category
  - tags (optional): Filter by tags
  - search (optional): Search in title/content
  - limit (optional): Limit number of results
- **Returns**: Array of document summaries with metadata
- **Format**: Each item includes title, ID, created date, tags, summary

### 3. doc_view
- **Purpose**: Get complete content of a specific document
- **Parameters**: 
  - docId (required): Document identifier
- **Returns**: Full document object with:
  - Metadata (title, created date, tags, category)
  - Complete markdown content
  - File path information
- **Usage**: Allows agents to read existing documentation

## Implementation Details

### File Structure
```
/src/mcp/tools/doc-tools.ts
/src/mcp/tools/doc-handlers.ts
/src/mcp/__tests__/unit/doc-tools.test.ts
```

### Core Integration
- Leverage existing document filesystem operations
- Follow established patterns from task-tools.ts
- Use consistent error handling and validation

### Schema Validation
```typescript
// doc_create schema
{
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    content: { type: "string", maxLength: 50000 },
    tags: { type: "array", items: { type: "string", maxLength: 50 } },
    category: { type: "string", maxLength: 100 }
  },
  required: ["title"]
}

// doc_list schema
{
  type: "object", 
  properties: {
    category: { type: "string", maxLength: 100 },
    tags: { type: "array", items: { type: "string", maxLength: 50 } },
    search: { type: "string", maxLength: 200 },
    limit: { type: "number", minimum: 1, maximum: 100 }
  },
  required: []
}

// doc_view schema  
{
  type: "object",
  properties: {
    docId: { type: "string", minLength: 1, maxLength: 100 }
  },
  required: ["docId"]
}
```

### Document Format
- Standard markdown files with YAML frontmatter
- Consistent metadata structure
- Support for tags and categorization

## Testing Requirements
- Test document creation with various content types
- Test listing with different filter combinations  
- Test viewing documents and proper content retrieval
- Test error handling for non-existent documents
- Test validation of input parameters

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 doc_create creates properly formatted markdown documents with frontmatter
- [ ] #2 doc_list returns filtered document summaries with metadata
- [ ] #3 doc_view provides complete document content and metadata
- [ ] #4 Documents support tags and categorization
- [ ] #5 Proper validation and error handling for all operations
- [ ] #6 Integration with existing filesystem document operations
- [ ] #7 Comprehensive test coverage for all document operations
<!-- AC:END -->


## Implementation Plan

## Implementation Plan for TASK-265.25

### Overview
Implement MCP document management tools (doc_create, doc_list, doc_view) following established patterns from task-tools.ts, with proper validation, error handling, and comprehensive test coverage.

### Phase 1: Core Infrastructure Enhancement
1. **Extend Core class** (`src/core/index.ts`):
   - Add `getDocument(id: string): Promise<Document>` method
   - Add `updateDocument(document: Document): Promise<void>` method (for future extensibility)
   - Add `deleteDocument(id: string): Promise<void>` method (for future extensibility)

### Phase 2: Document Tools Implementation
1. **Create `src/mcp/tools/document-tools.ts`**:
   - `doc_create`: Create markdown documents with frontmatter
   - `doc_list`: Return filtered document summaries with metadata
   - `doc_view`: Provide complete document content and metadata

2. **Schema Definitions**:
   - DocCreateSchema: title, content, type, tags, category
   - DocListSchema: type filter, tags filter, limit, offset
   - DocViewSchema: document ID

3. **Integration Points**:
   - Use existing `saveDocument()` and `listDocuments()` from file-system operations
   - Leverage document parsing/serialization from markdown modules
   - Follow validation patterns from task-tools.ts

### Phase 3: Validation & Error Handling
1. **Input Validation**:
   - Document title validation (required, max length)
   - Content validation (markdown format)
   - Type validation (readme, guide, specification, other)
   - Tags validation (array of strings, max count)

2. **Error Handling**:
   - File system errors (permissions, disk space)
   - Invalid document IDs
   - Malformed markdown content
   - Validation failures

### Phase 4: Tool Registration
1. **Update `src/mcp/tools/index.ts`**:
   - Export document tools
   - Add to tool registry

2. **Update `src/mcp/server.ts`**:
   - Register document tools with MCP server

### Phase 5: Testing Implementation
1. **Create `src/mcp/__tests__/unit/document-tools.test.ts`**:
   - Test each tool function independently
   - Test validation scenarios
   - Test error conditions
   - Test integration with Core class methods

2. **Test Coverage Goals**:
   - All acceptance criteria covered
   - Edge cases handled
   - Error conditions tested

### Technical Decisions & Rationale
1. **Schema Design**: Follow existing task-tools patterns for consistency
2. **Validation Strategy**: Use createAsyncValidatedTool for async operations
3. **Error Handling**: Consistent with existing MCP tools error patterns
4. **File Organization**: Separate document-tools.ts file for modularity

### Files to Modify/Create
- `src/core/index.ts` (extend Core class)
- `src/mcp/tools/document-tools.ts` (new file)
- `src/mcp/tools/index.ts` (update exports)
- `src/mcp/server.ts` (register tools)
- `src/mcp/__tests__/unit/document-tools.test.ts` (new test file)

### Risk Mitigation
- **Integration Risk**: Follow established patterns from task-tools.ts
- **Validation Risk**: Use existing validation framework
- **Testing Risk**: Comprehensive unit tests before integration

### Success Metrics
- All 7 acceptance criteria implemented and tested
- No regression in existing functionality
- Code passes all quality checks (lint, type, test)


## Implementation Notes

## Implementation Summary

Successfully implemented MCP document management tools with the following components:

### Core Infrastructure Extensions
- **Extended Core class**: Added `getDocument(id: string): Promise<Document>` method to `src/core/backlog.ts` (line 530)
- **Extended FileSystem**: Added `loadDocument(id: string): Promise<Document>` method to `src/file-system/operations.ts` (line 495)

### Document Tools Implementation
- **Created `src/mcp/tools/document-tools.ts`**: Main tool definitions with schema validation
  - `doc_create`: Creates markdown documents with frontmatter (title, content, type, tags)
  - `doc_list`: Returns filtered document summaries with pagination support
  - `doc_view`: Provides complete document content and metadata
- **Created `src/mcp/tools/document-handlers.ts`**: Business logic implementation
  - Integration with existing filesystem operations
  - Proper error handling and validation
  - JSON-formatted responses with metadata

### Schema Definitions & Validation
- **DocCreateSchema**: Validates title (required), content (required), type enum, tags array
- **DocListSchema**: Supports filtering by type, tags, limit, offset for pagination
- **DocViewSchema**: Requires document ID parameter
- Uses `createAsyncValidatedTool` and `createSimpleValidatedTool` for consistent validation

### Integration & Registration
- **Updated `src/mcp-stdio-server.ts`**: Registered document tools with MCP server
- **Tool Registration**: Added `registerDocumentTools(mcpServer)` to server startup
- **Import Structure**: Added document tools import and registration

### Testing Implementation
- **Created `src/mcp/__tests__/unit/document-tools.test.ts`**: Comprehensive test suite
  - Tool registration verification
  - Document creation with various parameters
  - Document listing with filtering and pagination
  - Document viewing with metadata
  - Error handling and validation testing
  - Integration with existing filesystem operations

### Technical Details
- **Type Safety**: All implementations use proper TypeScript types from `Document` interface
- **Error Handling**: Comprehensive error handling with user-friendly messages  
- **Validation**: Input validation for all required and optional parameters
- **Integration**: Seamless integration with existing document operations and CLI commands
- **Standards Compliance**: Follows established MCP tool patterns and project coding standards

### Files Modified/Created
- `src/core/backlog.ts` (extended Core class)
- `src/file-system/operations.ts` (added loadDocument method)
- `src/mcp/tools/document-tools.ts` (new file)
- `src/mcp/tools/document-handlers.ts` (new file)
- `src/mcp-stdio-server.ts` (added registration)
- `src/mcp/__tests__/unit/document-tools.test.ts` (new test file)

All acceptance criteria have been implemented with proper validation, error handling, and comprehensive test coverage.
