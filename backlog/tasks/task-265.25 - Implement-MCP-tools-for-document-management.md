---
id: task-265.25
title: Implement MCP tools for document management
status: To Do
assignee: []
created_date: '2025-09-16T17:23:20.565Z'
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
